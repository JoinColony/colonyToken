/* globals artifacts */

import chai from "chai";
import bnChai from "bn-chai";

const { expect } = chai;
chai.use(bnChai(web3.utils.BN));

const Token = artifacts.require("Token");
const VestingSimple = artifacts.require("VestingSimple");

contract.only("Vesting Simple", accounts => {
  let token;
  let vesting;

  before(async () => {
    token = await Token.new("Colony Token", "CLNY", 18);
  });

  beforeEach(async () => {
    vesting = await VestingSimple.new(token.address, { from: accounts[0] });
  });

  describe("when initialised", () => {
    it("should set the Token correctly", async () => {
      const tokenAddress = await vesting.token();
      expect(token.address).to.equal(tokenAddress);
    });
  });
});
