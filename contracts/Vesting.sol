pragma solidity ^0.4.21;
pragma experimental "v0.5.0";

import "./Token.sol";
import "../lib/dappsys/math.sol";


contract Vesting is DSMath {
  Token public token;
  address public colonyMultiSig;

  //uint constant public TOKEN_PRICE_MULTIPLIER = 1000;
  //uint constant public MIN_CONTRIBUTION = 10 finney;
  uint constant internal SECONDS_PER_MONTH = 2628000;

  struct Grant {
    uint amount;
    uint issuanceTime;
    uint vestingDuration;
    uint vestingCliff;
    uint64 monthsClaimed;
    uint totalClaimed;
  }
  mapping (address => Grant) public tokenGrants;

  event GrantAdded(address recipient, uint amount, uint issuanceTime, uint vestingDuration, uint vestingCliff);
  event GrantTokensClaimed(address recipient, uint amountClaimed);

  modifier onlycolonyMultiSig {
    require(msg.sender == colonyMultiSig);
    _;
  }

  modifier nonZeroAddress(address x) {
    require(x != 0);
    _;
  }

  function Vesting(address _token, address _colonyMultiSig) public
  nonZeroAddress(_token)
  nonZeroAddress(_colonyMultiSig)
  {
    token = Token(_token);
    colonyMultiSig = _colonyMultiSig;
  }

  // TODO: only colony multisig should be able to add this
  // TODO: Maybe transfer the token amount under the control of the vesting contract at this point
  // TODO: Think about other checks for vesting schedule to do here, e.g. duration mod cliff = 0, duration / cliff > 1?
  function addTokenGrant(address _recipient, uint _amount, uint _vestingDuration, uint _vestingCliff) public {
    Grant memory grant = Grant({
      amount: _amount,
      issuanceTime: now,
      vestingDuration: _vestingDuration,
      vestingCliff: _vestingCliff,
      monthsClaimed: 0,
      totalClaimed: 0
    });

    tokenGrants[_recipient] = grant;
    emit GrantAdded(_recipient, _amount, now, _vestingDuration, _vestingCliff);
  }

  function claimVestedTokens() public
  {
    Grant storage tokenGrant = tokenGrants[msg.sender];

    // Check cliff was reached
    uint elapsedTime = sub(now, tokenGrant.issuanceTime);
    uint64 elapsedMonths = uint64(elapsedTime / SECONDS_PER_MONTH);
    require(elapsedMonths >= tokenGrant.vestingCliff);

    // If over vesting duration, all tokens vested
    if (elapsedMonths >= tokenGrant.vestingDuration) {
      uint remainingGrant = sub(tokenGrant.amount, tokenGrant.totalClaimed);
      tokenGrant.monthsClaimed = uint64(tokenGrant.vestingDuration);
      tokenGrant.totalClaimed = tokenGrant.amount;
      token.transfer(msg.sender, remainingGrant);
      emit GrantTokensClaimed(msg.sender, remainingGrant);
    } else {
      uint64 monthsPendingClaim = uint64(sub(elapsedMonths, tokenGrant.monthsClaimed));
      // Calculate vested tokens and transfer them to recipient
      uint amountVestedPerMonth = tokenGrant.amount / tokenGrant.vestingDuration;
      uint amountVested = mul(monthsPendingClaim, amountVestedPerMonth);
      tokenGrant.monthsClaimed = elapsedMonths;
      tokenGrant.totalClaimed = add(tokenGrant.totalClaimed, amountVested);
      token.transfer(msg.sender, amountVested);
      emit GrantTokensClaimed(msg.sender, amountVested);
    }
  }

  // TODO: Function to terminate grant returning all non vested tokens to the Colony multisig
}
