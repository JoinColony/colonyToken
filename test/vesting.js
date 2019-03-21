/* globals artifacts */

import chai from "chai";
import bnChai from "bn-chai";
import BN from "bn.js";
import { asciiToHex, toWei } from "web3-utils";
import { currentBlockTime, forwardTime, expectEvent, checkErrorRevert } from "../helpers/test-helper";

const { expect } = chai;
chai.use(bnChai(web3.utils.BN));

const Token = artifacts.require("Token");
const Vesting = artifacts.require("Vesting");
const MultiSigWallet = artifacts.require("MultiSigWallet");
const TokenAuthority = artifacts.require("TokenAuthority");
const DSAuth = artifacts.require("DSAuth");

contract("Vesting", accounts => {
  const SECONDS_PER_MONTH = 2628000;
  const ACCOUNT_1 = accounts[1];
  const ACCOUNT_2 = accounts[2];
  const ACCOUNT_3 = accounts[3];
  const ACCOUNT_4 = accounts[4];
  const ACCOUNT_5 = accounts[5];
  const ACCOUNT_6 = accounts[6];
  const ACCOUNT_7 = accounts[7];
  const ACCOUNT_8 = accounts[8];
  const ACCOUNT_9 = accounts[9];
  const ACCOUNT_10 = accounts[10];
  const OTHER_ACCOUNT = accounts[11];

  const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
  const ACCOUNT_1_GRANT_AMOUNT = new BN(toWei("998", "finney"));
  const ACCOUNT_2_GRANT_AMOUNT = new BN(toWei("10001", "szabo"));
  const ACCOUNT_3_GRANT_AMOUNT = new BN(toWei("2", "ether"));
  const ACCOUNT_4_GRANT_AMOUNT = new BN(toWei("10001", "szabo"));
  const ACCOUNT_5_GRANT_AMOUNT = new BN(toWei("20", "finney"));
  const ACCOUNT_6_GRANT_AMOUNT = new BN(toWei("10001", "szabo"));
  const ACCOUNT_7_GRANT_AMOUNT = new BN(toWei("998", "finney"));
  const ACCOUNT_8_GRANT_AMOUNT = new BN(toWei("10001", "szabo"));
  const ACCOUNT_9_GRANT_AMOUNT = new BN(toWei("998", "finney"));
  const ACCOUNT_10_GRANT_AMOUNT = new BN(toWei("10001", "szabo"));

  const TOTAL_SUPPLY = ACCOUNT_1_GRANT_AMOUNT.add(ACCOUNT_2_GRANT_AMOUNT)
    .add(ACCOUNT_3_GRANT_AMOUNT)
    .add(ACCOUNT_4_GRANT_AMOUNT)
    .add(ACCOUNT_5_GRANT_AMOUNT)
    .add(ACCOUNT_6_GRANT_AMOUNT)
    .add(ACCOUNT_7_GRANT_AMOUNT)
    .add(ACCOUNT_8_GRANT_AMOUNT)
    .add(ACCOUNT_9_GRANT_AMOUNT)
    .add(ACCOUNT_10_GRANT_AMOUNT);

  let colonyMultiSig;
  let token;
  let vesting;

  before(async () => {
    colonyMultiSig = await MultiSigWallet.deployed();
  });

  beforeEach(async () => {
    token = await Token.new(asciiToHex("Colony token"), asciiToHex("CLNY"), 18);
    vesting = await Vesting.new(token.address, colonyMultiSig.address);

    const tokenAuthority = await TokenAuthority.new(
      token.address,
      ZERO_ADDRESS,
      ZERO_ADDRESS,
      ZERO_ADDRESS,
      vesting.address,
      [ZERO_ADDRESS],
      ZERO_ADDRESS
    );
    await token.setAuthority(tokenAuthority.address);
    await token.setOwner(colonyMultiSig.address);

    let txData = await token.contract.methods.mint(TOTAL_SUPPLY.toString()).encodeABI();
    await colonyMultiSig.submitTransaction(token.address, 0, txData);

    const totalBalance = await token.balanceOf(colonyMultiSig.address);
    expect(totalBalance).to.eq.BN(TOTAL_SUPPLY);

    // Approve the total balance to be tranferred by the vesting contract as part of the `addTokenGrant` call
    txData = await token.contract.methods.approve(vesting.address, TOTAL_SUPPLY.toString()).encodeABI();
    await colonyMultiSig.submitTransaction(token.address, 0, txData);
  });

  describe("when initialised", () => {
    it("should set the Token correctly", async () => {
      const tokenAddress = await vesting.token();
      expect(token.address).to.equal(tokenAddress);
    });

    it("should set the MultiSig correctly", async () => {
      const multiSigAddress = await vesting.colonyMultiSig();
      expect(colonyMultiSig.address).to.equal(multiSigAddress);
    });

    it("should fail with 0 address for Token", async () => {
      let vestingContract = "";
      try {
        vestingContract = await Vesting.new(ZERO_ADDRESS, colonyMultiSig.address);
      } catch (err) {} // eslint-disable-line no-empty
      expect(vestingContract).to.equal("");
    });

    it("should fail with 0 address for MultiSig", async () => {
      let vestingContract = "";
      try {
        vestingContract = await Vesting.new(token.address, ZERO_ADDRESS);
      } catch (err) {} // eslint-disable-line no-empty
      expect(vestingContract).to.equal("");
    });
  });

  function testSpecifications() {
    describe("when creating token grants", () => {
      it("should create grant correctly, when a startDate in the past is used", async () => {
        const currentTime = await currentBlockTime();
        const txData = await vesting.contract.methods.addTokenGrant(ACCOUNT_1, currentTime - SECONDS_PER_MONTH, 1000, 24, 6).encodeABI();
        await colonyMultiSig.submitTransaction(vesting.address, 0, txData);

        const grant = await vesting.tokenGrants(ACCOUNT_1);
        expect(grant.startTime.toNumber()).to.equal(currentTime - SECONDS_PER_MONTH);
        expect(grant.amount).to.eq.BN(1000);
        expect(grant.vestingDuration).to.eq.BN(24);
        expect(grant.vestingCliff).to.eq.BN(6);
        expect(grant.monthsClaimed).to.be.zero;
        expect(grant.totalClaimed).to.be.zero;
      });

      it("should create grant correctly, when a startDate in the future is used", async () => {
        const currentTime = await currentBlockTime();
        const txData = await vesting.contract.methods.addTokenGrant(ACCOUNT_1, currentTime + SECONDS_PER_MONTH, 1000, 24, 6).encodeABI();
        await colonyMultiSig.submitTransaction(vesting.address, 0, txData);

        const grant = await vesting.tokenGrants(ACCOUNT_1);
        expect(grant.startTime.toNumber()).to.equal(currentTime + SECONDS_PER_MONTH);
        expect(grant.amount).to.eq.BN(1000);
        expect(grant.vestingDuration).to.eq.BN(24);
        expect(grant.vestingCliff).to.eq.BN(6);
        expect(grant.monthsClaimed).to.be.zero;
        expect(grant.totalClaimed).to.be.zero;

        const x = await vesting.calculateGrantClaim(ACCOUNT_1);
        expect(x[0]).to.be.zero;
        expect(x[1]).to.be.zero;
      });

      it("should create grant correctly, using the current time, when no startDate was passed", async () => {
        const currentTime = await currentBlockTime();
        const txData = await vesting.contract.methods.addTokenGrant(ACCOUNT_1, 0, 1000, 24, 6).encodeABI();
        await colonyMultiSig.submitTransaction(vesting.address, 0, txData);

        const grant = await vesting.tokenGrants(ACCOUNT_1);
        expect(grant.startTime.toNumber()).to.be.closeTo(currentTime, 10);
        expect(grant.amount).to.eq.BN(1000);
        expect(grant.vestingDuration).to.eq.BN(24);
        expect(grant.vestingCliff).to.eq.BN(6);
        expect(grant.monthsClaimed).to.be.zero;
        expect(grant.totalClaimed).to.be.zero;
      });

      it("should log correct event", async () => {
        const txData = await vesting.contract.methods.addTokenGrant(ACCOUNT_1, 0, 1000, 24, 6).encodeABI();
        await expectEvent(colonyMultiSig.submitTransaction(vesting.address, 0, txData), "Execution");
      });

      it("should error if called by anyone but the Colony multisig", async () => {
        await checkErrorRevert(vesting.addTokenGrant(ACCOUNT_1, 0, 1000, 24, 6, { from: OTHER_ACCOUNT }), "colony-vesting-unauthorized");
      });

      it("should error if there is an existing grant for user", async () => {
        const txData = await vesting.contract.methods.addTokenGrant(ACCOUNT_1, 0, 1000, 24, 6).encodeABI();
        await colonyMultiSig.submitTransaction(vesting.address, 0, txData);
        await expectEvent(colonyMultiSig.submitTransaction(vesting.address, 0, txData), "ExecutionFailure");
      });

      it("should error if duration is 0", async () => {
        const txData = await vesting.contract.methods.addTokenGrant(ACCOUNT_1, 0, 1000, 0, 6).encodeABI();
        await expectEvent(colonyMultiSig.submitTransaction(vesting.address, 0, txData), "ExecutionFailure");
      });

      it("should error if cliff is 0", async () => {
        const txData = await vesting.contract.methods.addTokenGrant(ACCOUNT_1, 0, 1000, 24, 0).encodeABI();
        await expectEvent(colonyMultiSig.submitTransaction(vesting.address, 0, txData), "ExecutionFailure");
      });

      it("should error if amount/duration is not greater than zero", async () => {
        const txData = await vesting.contract.methods.addTokenGrant(ACCOUNT_1, 0, 1000, 1001, 6).encodeABI();
        await expectEvent(colonyMultiSig.submitTransaction(vesting.address, 0, txData), "ExecutionFailure");
      });

      it("should error on grant amount overflow", async () => {
        const grantAmount = new BN(2).pow(new BN(128)).addn(1);
        const txData = await vesting.contract.methods.addTokenGrant(ACCOUNT_1, 0, grantAmount.toString(), 24, 6).encodeABI();
        await expectEvent(colonyMultiSig.submitTransaction(vesting.address, 0, txData), "ExecutionFailure");

        const grant = await vesting.tokenGrants(ACCOUNT_1);
        expect(grant.startTime).to.be.zero;
      });

      it("should error on grant duration overflow", async () => {
        const grantDuration = new BN(2).pow(new BN(16)).addn(1);
        const txData = await vesting.contract.methods
          .addTokenGrant(ACCOUNT_1, 0, grantDuration.muln(10).toString(), grantDuration.toString(), 6)
          .encodeABI();
        await expectEvent(colonyMultiSig.submitTransaction(vesting.address, 0, txData), "ExecutionFailure");

        const grant = await vesting.tokenGrants(ACCOUNT_1);
        expect(grant.startTime).to.be.zero;
      });

      it("should error if grant amount cannot be transferred", async () => {
        // Remove the allowance for the vesting contract
        let txData = await token.contract.methods.approve(vesting.address, 0).encodeABI();
        await colonyMultiSig.submitTransaction(token.address, 0, txData);

        txData = await vesting.contract.methods.addTokenGrant(ACCOUNT_1, 0, 10, 24, 6).encodeABI();
        await expectEvent(colonyMultiSig.submitTransaction(vesting.address, 0, txData), "ExecutionFailure");

        const grant = await vesting.tokenGrants(ACCOUNT_1);
        expect(grant.startTime).to.be.zero;
      });
    });

    describe("when removing token grants", () => {
      beforeEach(async () => {
        const txData = await vesting.contract.methods.addTokenGrant(ACCOUNT_1, 0, ACCOUNT_1_GRANT_AMOUNT.toString(), 24, 6).encodeABI();
        await colonyMultiSig.submitTransaction(vesting.address, 0, txData);
      });

      it("should remove the grant", async () => {
        const txData = await vesting.contract.methods.removeTokenGrant(ACCOUNT_1).encodeABI();
        await colonyMultiSig.submitTransaction(vesting.address, 0, txData);

        const grant = await vesting.tokenGrants(ACCOUNT_1);
        expect(grant.startTime).to.be.zero;
        expect(grant.amount).to.be.zero;
        expect(grant.vestingDuration).to.be.zero;
        expect(grant.vestingCliff).to.be.zero;
        expect(grant.monthsClaimed).to.be.zero;
        expect(grant.totalClaimed).to.be.zero;
      });

      it("should return non-vested tokens to the Colony MultiSig", async () => {
        const balanceBefore = await token.balanceOf(colonyMultiSig.address);
        // 7 months vested
        await forwardTime(SECONDS_PER_MONTH * 7, this);

        // Grant is of total 998 finney
        const txData = await vesting.contract.methods.removeTokenGrant(ACCOUNT_1).encodeABI();
        await colonyMultiSig.submitTransaction(vesting.address, 0, txData);

        const balanceAfter = await token.balanceOf(colonyMultiSig.address);

        const balanceChange = balanceAfter.sub(balanceBefore).toString();
        expect(balanceChange).to.eq.BN(new BN("706916666666666669"));
      });

      it("should give grant recipient any vested amount", async () => {
        const balanceBefore = await token.balanceOf(ACCOUNT_1);
        // 7 months vested
        await forwardTime(SECONDS_PER_MONTH * 7, this);
        // Grant is of total 998 finney
        const txData = await vesting.contract.methods.removeTokenGrant(ACCOUNT_1).encodeABI();
        await colonyMultiSig.submitTransaction(vesting.address, 0, txData);

        const balanceAfter = await token.balanceOf(ACCOUNT_1);
        const balanceChange = balanceAfter.sub(balanceBefore).toString();
        expect(balanceChange).to.eq.BN(new BN("291083333333333331"));
      });

      it("should return the correct amounts if there have been tokens claimed already", async () => {
        const balanceBeforeMultiSig = await token.balanceOf(colonyMultiSig.address);
        const balanceBeforeRecipient = await token.balanceOf(ACCOUNT_1);

        // 7 months vested and claimed
        await forwardTime(SECONDS_PER_MONTH * 7, this);
        await vesting.claimVestedTokens({ from: ACCOUNT_1 });
        // Another 6 months vested and claimed
        await forwardTime(SECONDS_PER_MONTH * 6, this);
        await vesting.claimVestedTokens({ from: ACCOUNT_1 });
        const balanceAfterClaimsRecipient = await token.balanceOf(ACCOUNT_1);
        const balanceChangeAfterClaimsRecipient = balanceAfterClaimsRecipient.sub(balanceBeforeRecipient).toString();
        expect(balanceChangeAfterClaimsRecipient).to.eq.BN(new BN("540583333333333329"));

        // Another 3 months vested but not claimed
        await forwardTime(SECONDS_PER_MONTH * 3, this);

        // Grant is of total 998 finney
        // 16 months vested of which 13 months claimed, another 6 months not yet vested
        const txData = await vesting.contract.methods.removeTokenGrant(ACCOUNT_1).encodeABI();
        await colonyMultiSig.submitTransaction(vesting.address, 0, txData);

        const balanceAfterRecipient = await token.balanceOf(ACCOUNT_1);
        const balanceChangeRecipient = balanceAfterRecipient.sub(balanceAfterClaimsRecipient).toString();
        // Expecting 3 months worth of vested unclaimed tokens here
        expect(balanceChangeRecipient).to.eq.BN(new BN("124749999999999999"));
        // Expectingt their total balanace to be 16 months worth of vested tokens
        expect(balanceAfterRecipient.sub(balanceBeforeRecipient)).to.eq.BN(new BN("665333333333333328"));

        const balanceAfterMultiSig = await token.balanceOf(colonyMultiSig.address);
        const balanceChangeMultiSig = balanceAfterMultiSig.sub(balanceBeforeMultiSig).toString();
        // Expecting non-vested tokens here to = total grant amount - 16 months worth of vested tokens
        expect(balanceChangeMultiSig).to.eq.BN(new BN("332666666666666672"));
      });

      it("should be able to add a new grant for same recipient as one removed", async () => {
        let txData = await vesting.contract.methods.removeTokenGrant(ACCOUNT_1).encodeABI();
        await colonyMultiSig.submitTransaction(vesting.address, 0, txData);

        txData = await vesting.contract.methods.addTokenGrant(ACCOUNT_1, 0, 1001, 24, 6).encodeABI();
        await colonyMultiSig.submitTransaction(vesting.address, 0, txData);

        const grant = await vesting.tokenGrants(ACCOUNT_1);
        expect(grant.amount).to.eq.BN(1001);
      });

      it("should error if called by anyone but the Colony multisig", async () => {
        await checkErrorRevert(vesting.removeTokenGrant(ACCOUNT_1, { from: OTHER_ACCOUNT }), "colony-vesting-unauthorized");
      });
    });

    describe("when claiming vested tokens", () => {
      it("should NOT be able to claim within the first month", async () => {
        const txData = await vesting.contract.methods.addTokenGrant(ACCOUNT_1, 0, ACCOUNT_1_GRANT_AMOUNT.toString(10), 24, 6).encodeABI();
        await colonyMultiSig.submitTransaction(vesting.address, 0, txData);
        await forwardTime(3600);
        const balanceBefore = await token.balanceOf(ACCOUNT_1);
        expect(balanceBefore).to.be.zero;

        await checkErrorRevert(vesting.claimVestedTokens({ from: ACCOUNT_1 }), "colony-token-zero-amount-vested");

        const balanceAfter = await token.balanceOf(ACCOUNT_1);
        expect(balanceAfter).to.be.zero;
      });

      it("should NOT be able to claim before cliff reached", async () => {
        const txData = await vesting.contract.methods.addTokenGrant(ACCOUNT_1, 0, ACCOUNT_1_GRANT_AMOUNT.toString(10), 24, 6).encodeABI();
        await colonyMultiSig.submitTransaction(vesting.address, 0, txData);
        await forwardTime(SECONDS_PER_MONTH * 6 - 3600);
        const balanceBefore = await token.balanceOf(ACCOUNT_1);
        expect(balanceBefore).to.be.zero;

        await checkErrorRevert(vesting.claimVestedTokens({ from: ACCOUNT_1 }), "colony-token-zero-amount-vested");

        const balanceAfter = await token.balanceOf(ACCOUNT_1);
        expect(balanceAfter).to.be.zero;
      });

      it("should NOT be able to claim a non-existent grant", async () => {
        await checkErrorRevert(vesting.claimVestedTokens({ from: OTHER_ACCOUNT }), "colony-token-zero-amount-vested");
        const balanceAfter = await token.balanceOf(OTHER_ACCOUNT);
        expect(balanceAfter).to.be.zero;
      });

      const account1GrantProperties = [
        { duration: 24, cliff: 6, startTimeMonthsBeforeNow: 0, monthsElapsed: 6 }, // 24 months duration, 6 months cliff cases
        { duration: 24, cliff: 6, startTimeMonthsBeforeNow: 0, monthsElapsed: 7 },
        { duration: 24, cliff: 6, startTimeMonthsBeforeNow: 0, monthsElapsed: 8 },
        { duration: 24, cliff: 6, startTimeMonthsBeforeNow: 0, monthsElapsed: 9 },
        { duration: 24, cliff: 6, startTimeMonthsBeforeNow: 0, monthsElapsed: 10 },
        { duration: 24, cliff: 6, startTimeMonthsBeforeNow: 0, monthsElapsed: 11 },
        { duration: 24, cliff: 6, startTimeMonthsBeforeNow: 0, monthsElapsed: 12 },
        { duration: 24, cliff: 6, startTimeMonthsBeforeNow: 0, monthsElapsed: 18 },
        { duration: 24, cliff: 6, startTimeMonthsBeforeNow: 0, monthsElapsed: 24 },
        { duration: 6, cliff: 1, startTimeMonthsBeforeNow: 0, monthsElapsed: 1 }, // 6 months duration, 1 month cliff cases
        { duration: 6, cliff: 1, startTimeMonthsBeforeNow: 0, monthsElapsed: 2 },
        { duration: 6, cliff: 1, startTimeMonthsBeforeNow: 0, monthsElapsed: 3 },
        { duration: 6, cliff: 1, startTimeMonthsBeforeNow: 0, monthsElapsed: 4 },
        { duration: 6, cliff: 1, startTimeMonthsBeforeNow: 0, monthsElapsed: 5 },
        { duration: 6, cliff: 1, startTimeMonthsBeforeNow: 0, monthsElapsed: 6 },
        { duration: 15, cliff: 2, startTimeMonthsBeforeNow: 1, monthsElapsed: 1 }, // Other mixed cases of valid grant options
        { duration: 18, cliff: 4, startTimeMonthsBeforeNow: 3, monthsElapsed: 10 },
        { duration: 25, cliff: 7, startTimeMonthsBeforeNow: 1, monthsElapsed: 21 },
        { duration: 33, cliff: 10, startTimeMonthsBeforeNow: 2, monthsElapsed: 26 },
        { duration: 34, cliff: 9, startTimeMonthsBeforeNow: 4, monthsElapsed: 29 },
        { duration: 40, cliff: 12, startTimeMonthsBeforeNow: 9, monthsElapsed: 25 }
      ];

      account1GrantProperties.forEach(async grantProp => {
        it(`${grantProp.monthsElapsed} months after grant start date, user should be able to claim
         ${grantProp.monthsElapsed}/${grantProp.duration + grantProp.startTimeMonthsBeforeNow} of their total token grant`, async () => {
          const currentTime = await currentBlockTime();
          const txData = await vesting.contract.methods
            .addTokenGrant(
              ACCOUNT_1,
              currentTime - grantProp.startTimeMonthsBeforeNow * SECONDS_PER_MONTH,
              ACCOUNT_1_GRANT_AMOUNT.toString(10),
              grantProp.duration,
              grantProp.cliff
            )
            .encodeABI();
          await colonyMultiSig.submitTransaction(vesting.address, 0, txData);

          const timeToForward = SECONDS_PER_MONTH * grantProp.monthsElapsed;
          await forwardTime(timeToForward, this);
          const balanceBefore = await token.balanceOf(ACCOUNT_1);
          expect(balanceBefore).to.be.zero;

          await vesting.claimVestedTokens({ from: ACCOUNT_1 });
          const balanceAfter = await token.balanceOf(ACCOUNT_1);

          let expectedClaimedAmount;
          if (grantProp.monthsElapsed >= grantProp.duration) {
            expectedClaimedAmount = ACCOUNT_1_GRANT_AMOUNT;
          } else {
            expectedClaimedAmount = ACCOUNT_1_GRANT_AMOUNT.divn(grantProp.duration).muln(
              grantProp.monthsElapsed + grantProp.startTimeMonthsBeforeNow
            );
          }

          expect(balanceAfter).to.eq.BN(expectedClaimedAmount);

          const tokenGrant = await vesting.tokenGrants(ACCOUNT_1);
          expect(tokenGrant.monthsClaimed).to.eq.BN(grantProp.monthsElapsed + grantProp.startTimeMonthsBeforeNow);
          expect(tokenGrant.totalClaimed).to.eq.BN(expectedClaimedAmount);
        });
      });

      const grantProperties = [
        { account: ACCOUNT_1, amount: ACCOUNT_1_GRANT_AMOUNT, duration: 24, cliff: 6 }, // claim at month 6, 20, 24
        { account: ACCOUNT_2, amount: ACCOUNT_2_GRANT_AMOUNT, duration: 24, cliff: 5 }, // claim at month 6, 20, 24
        { account: ACCOUNT_3, amount: ACCOUNT_3_GRANT_AMOUNT, duration: 12, cliff: 1 }, // claim at month 1, 12
        { account: ACCOUNT_4, amount: ACCOUNT_4_GRANT_AMOUNT, duration: 36, cliff: 12 }, // claim at month 12, 20, 24, 36
        { account: ACCOUNT_5, amount: ACCOUNT_5_GRANT_AMOUNT, duration: 33, cliff: 12 }, // claim at month 12, 20, 24, 36
        { account: ACCOUNT_6, amount: ACCOUNT_6_GRANT_AMOUNT, duration: 28, cliff: 9 }, // claim at month 12, 24, 36
        { account: ACCOUNT_7, amount: ACCOUNT_7_GRANT_AMOUNT, duration: 20, cliff: 2 }, // claim at month 2, 17, 20
        { account: ACCOUNT_8, amount: ACCOUNT_8_GRANT_AMOUNT, duration: 12, cliff: 3 }, // claim at month 3, 12
        { account: ACCOUNT_9, amount: ACCOUNT_9_GRANT_AMOUNT, duration: 16, cliff: 4 }, // claim at month 4, 17
        { account: ACCOUNT_10, amount: ACCOUNT_10_GRANT_AMOUNT, duration: 6, cliff: 1 } // claim at month 1, 12
      ];

      it("should be able to handle multiple grants correctly over time", async () => {
        await Promise.all(
          grantProperties.map(async grantProp => {
            const txData = await vesting.contract.methods
              .addTokenGrant(grantProp.account, 0, grantProp.amount.toString(10), grantProp.duration, grantProp.cliff)
              .encodeABI();
            await colonyMultiSig.submitTransaction(vesting.address, 0, txData);
          })
        );

        let balanceBefore;
        let balanceAfter;
        // Go forward 1 month
        await forwardTime(SECONDS_PER_MONTH, this);
        // Check account 3 and 10 can claim correctly
        balanceBefore = await token.balanceOf(ACCOUNT_3);
        await vesting.claimVestedTokens({ from: ACCOUNT_3 });
        balanceAfter = await token.balanceOf(ACCOUNT_3);
        expect(balanceAfter.sub(balanceBefore)).to.eq.BN(ACCOUNT_3_GRANT_AMOUNT.divn(12));

        balanceBefore = await token.balanceOf(ACCOUNT_10);
        await vesting.claimVestedTokens({ from: ACCOUNT_10 });
        balanceAfter = await token.balanceOf(ACCOUNT_10);
        expect(balanceAfter.sub(balanceBefore)).to.eq.BN(ACCOUNT_10_GRANT_AMOUNT.divn(6));

        // Go forward another 1 month, to the end of month 2 since grants created
        await forwardTime(SECONDS_PER_MONTH, this);
        // Check account 7 can claim correctly
        balanceBefore = await token.balanceOf(ACCOUNT_7);
        await vesting.claimVestedTokens({ from: ACCOUNT_7 });
        balanceAfter = await token.balanceOf(ACCOUNT_7);
        expect(balanceAfter.sub(balanceBefore)).to.eq.BN(ACCOUNT_7_GRANT_AMOUNT.divn(20).muln(2));

        // Go forward another 1 month, to the end of month 3 since grants created
        await forwardTime(SECONDS_PER_MONTH, this);
        // Check account 8 can claim correctly
        balanceBefore = await token.balanceOf(ACCOUNT_8);
        await vesting.claimVestedTokens({ from: ACCOUNT_8 });
        balanceAfter = await token.balanceOf(ACCOUNT_8);
        expect(balanceAfter.sub(balanceBefore)).to.eq.BN(ACCOUNT_8_GRANT_AMOUNT.divn(12).muln(3));

        // Go forward another 1 month, to the end of month 4 since grants created
        await forwardTime(SECONDS_PER_MONTH, this);
        // Check account 9 can claim correctly
        balanceBefore = await token.balanceOf(ACCOUNT_9);
        await vesting.claimVestedTokens({ from: ACCOUNT_9 });
        balanceAfter = await token.balanceOf(ACCOUNT_9);
        expect(balanceAfter.sub(balanceBefore)).to.eq.BN(ACCOUNT_9_GRANT_AMOUNT.divn(16).muln(4));

        // Go forward another 2 months, to the end of month 6 since grants created
        await forwardTime(SECONDS_PER_MONTH * 2, this);
        // Check accounts 1 and 2 can claim correctly
        balanceBefore = await token.balanceOf(ACCOUNT_1);
        await vesting.claimVestedTokens({ from: ACCOUNT_1 });
        balanceAfter = await token.balanceOf(ACCOUNT_1);
        expect(balanceAfter.sub(balanceBefore)).to.eq.BN(ACCOUNT_1_GRANT_AMOUNT.divn(24).muln(6));

        balanceBefore = await token.balanceOf(ACCOUNT_2);
        await vesting.claimVestedTokens({ from: ACCOUNT_2 });
        balanceAfter = await token.balanceOf(ACCOUNT_2);
        expect(balanceAfter.sub(balanceBefore)).to.eq.BN(ACCOUNT_2_GRANT_AMOUNT.divn(24).muln(6));

        // Go forward another 6 months, to the end of month 12 since grants created
        await forwardTime(SECONDS_PER_MONTH * 6, this);
        // Check accounts 4, 5 and 6 can claim correctly
        balanceBefore = await token.balanceOf(ACCOUNT_4);
        await vesting.claimVestedTokens({ from: ACCOUNT_4 });
        balanceAfter = await token.balanceOf(ACCOUNT_4);
        expect(balanceAfter.sub(balanceBefore)).to.eq.BN(ACCOUNT_4_GRANT_AMOUNT.divn(36).muln(12));

        balanceBefore = await token.balanceOf(ACCOUNT_5);
        await vesting.claimVestedTokens({ from: ACCOUNT_5 });
        balanceAfter = await token.balanceOf(ACCOUNT_5);
        expect(balanceAfter.sub(balanceBefore)).to.eq.BN(ACCOUNT_5_GRANT_AMOUNT.divn(33).muln(12));

        balanceBefore = await token.balanceOf(ACCOUNT_6);
        await vesting.claimVestedTokens({ from: ACCOUNT_6 });
        balanceAfter = await token.balanceOf(ACCOUNT_6);
        expect(balanceAfter.sub(balanceBefore)).to.eq.BN(ACCOUNT_6_GRANT_AMOUNT.divn(28).muln(12));

        // Check account 3, 8 and 10 can claim their entire left grant
        await vesting.claimVestedTokens({ from: ACCOUNT_3 });
        balanceAfter = await token.balanceOf(ACCOUNT_3);
        expect(balanceAfter).to.eq.BN(ACCOUNT_3_GRANT_AMOUNT);

        await vesting.claimVestedTokens({ from: ACCOUNT_8 });
        balanceAfter = await token.balanceOf(ACCOUNT_8);
        expect(balanceAfter).to.eq.BN(ACCOUNT_8_GRANT_AMOUNT);

        await vesting.claimVestedTokens({ from: ACCOUNT_10 });
        balanceAfter = await token.balanceOf(ACCOUNT_10);
        expect(balanceAfter).to.eq.BN(ACCOUNT_10_GRANT_AMOUNT);

        // Go forward another 5 months, to the end of month 17 since grants created
        await forwardTime(SECONDS_PER_MONTH * 5, this);
        // Check account 9 can claim their entire left grant
        await vesting.claimVestedTokens({ from: ACCOUNT_9 });
        balanceAfter = await token.balanceOf(ACCOUNT_9);
        expect(balanceAfter).to.eq.BN(ACCOUNT_9_GRANT_AMOUNT);

        // Check account 7 can claim (15 months vested tokens) correctly
        balanceBefore = await token.balanceOf(ACCOUNT_7);
        await vesting.claimVestedTokens({ from: ACCOUNT_7 });
        balanceAfter = await token.balanceOf(ACCOUNT_7);
        expect(balanceAfter.sub(balanceBefore)).to.eq.BN(ACCOUNT_7_GRANT_AMOUNT.divn(20).muln(17 - 2));

        // Go forward another 3 months, to the end of month 20 since grants created
        await forwardTime(SECONDS_PER_MONTH * 3, this);
        // Check account 7 can claim their entire left grant
        await vesting.claimVestedTokens({ from: ACCOUNT_7 });
        balanceAfter = await token.balanceOf(ACCOUNT_7);
        expect(balanceAfter).to.eq.BN(ACCOUNT_7_GRANT_AMOUNT);

        // Check accounts 1, 2, 4 and 5 can claim correctly
        balanceBefore = await token.balanceOf(ACCOUNT_1);
        await vesting.claimVestedTokens({ from: ACCOUNT_1 });
        balanceAfter = await token.balanceOf(ACCOUNT_1);
        expect(balanceAfter.sub(balanceBefore)).to.eq.BN(ACCOUNT_1_GRANT_AMOUNT.divn(24).muln(20 - 6));

        balanceBefore = await token.balanceOf(ACCOUNT_2);
        await vesting.claimVestedTokens({ from: ACCOUNT_2 });
        balanceAfter = await token.balanceOf(ACCOUNT_2);
        expect(balanceAfter.sub(balanceBefore)).to.eq.BN(ACCOUNT_2_GRANT_AMOUNT.divn(24).muln(20 - 6));

        balanceBefore = await token.balanceOf(ACCOUNT_4);
        await vesting.claimVestedTokens({ from: ACCOUNT_4 });
        balanceAfter = await token.balanceOf(ACCOUNT_4);
        expect(balanceAfter.sub(balanceBefore)).to.eq.BN(ACCOUNT_4_GRANT_AMOUNT.divn(36).muln(20 - 12));

        balanceBefore = await token.balanceOf(ACCOUNT_5);
        await vesting.claimVestedTokens({ from: ACCOUNT_5 });
        balanceAfter = await token.balanceOf(ACCOUNT_5);
        expect(balanceAfter.sub(balanceBefore)).to.eq.BN(ACCOUNT_5_GRANT_AMOUNT.divn(33).muln(20 - 12));

        // Go forward another 4 months, to the end of month 24 since grants created
        await forwardTime(SECONDS_PER_MONTH * 4, this);
        // Check account 1 and 2 can claim their entire left grant
        await vesting.claimVestedTokens({ from: ACCOUNT_1 });
        balanceAfter = await token.balanceOf(ACCOUNT_1);
        expect(balanceAfter).to.eq.BN(ACCOUNT_1_GRANT_AMOUNT);

        await vesting.claimVestedTokens({ from: ACCOUNT_2 });
        balanceAfter = await token.balanceOf(ACCOUNT_2);
        expect(balanceAfter).to.eq.BN(ACCOUNT_2_GRANT_AMOUNT);

        // Check accounts 4, 5 and 6 can claim correctly
        balanceBefore = await token.balanceOf(ACCOUNT_4);
        await vesting.claimVestedTokens({ from: ACCOUNT_4 });
        balanceAfter = await token.balanceOf(ACCOUNT_4);
        expect(balanceAfter.sub(balanceBefore)).to.eq.BN(ACCOUNT_4_GRANT_AMOUNT.divn(36).muln(24 - 20));

        balanceBefore = await token.balanceOf(ACCOUNT_5);
        await vesting.claimVestedTokens({ from: ACCOUNT_5 });
        balanceAfter = await token.balanceOf(ACCOUNT_5);
        expect(balanceAfter.sub(balanceBefore)).to.eq.BN(ACCOUNT_5_GRANT_AMOUNT.divn(33).muln(24 - 20));

        balanceBefore = await token.balanceOf(ACCOUNT_6);
        await vesting.claimVestedTokens({ from: ACCOUNT_6 });
        balanceAfter = await token.balanceOf(ACCOUNT_6);
        expect(balanceAfter.sub(balanceBefore)).to.eq.BN(ACCOUNT_6_GRANT_AMOUNT.divn(28).muln(24 - 12));

        // Go forward another 12 months, to the end of month 36 since grants created
        await forwardTime(SECONDS_PER_MONTH * 12, this);
        // Check account 4, 5 and 6 can claim their entire left grant
        await vesting.claimVestedTokens({ from: ACCOUNT_4 });
        balanceAfter = await token.balanceOf(ACCOUNT_4);
        expect(balanceAfter).to.eq.BN(ACCOUNT_4_GRANT_AMOUNT);

        await vesting.claimVestedTokens({ from: ACCOUNT_5 });
        balanceAfter = await token.balanceOf(ACCOUNT_5);
        expect(balanceAfter).to.eq.BN(ACCOUNT_5_GRANT_AMOUNT);

        await vesting.claimVestedTokens({ from: ACCOUNT_6 });
        balanceAfter = await token.balanceOf(ACCOUNT_6);
        expect(balanceAfter).to.eq.BN(ACCOUNT_6_GRANT_AMOUNT);
      });
    });
  }

  describe("when working with a locked token", () => {
    testSpecifications();
  });

  describe("when working with an unlocked token", () => {
    beforeEach(async () => {
      let txData = await token.contract.methods.unlock().encodeABI();
      await colonyMultiSig.submitTransaction(token.address, 0, txData);

      const dsAuthToken = await DSAuth.at(token.address);
      txData = await dsAuthToken.contract.methods.setAuthority(ZERO_ADDRESS).encodeABI();
      await colonyMultiSig.submitTransaction(token.address, 0, txData);

      const locked = await token.locked();
      expect(locked).to.be.false;
    });

    testSpecifications();
  });
});
