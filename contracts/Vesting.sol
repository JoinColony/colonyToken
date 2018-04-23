pragma solidity ^0.4.21;
pragma experimental "v0.5.0";

import "./Token.sol";
import "../lib/dappsys/math.sol";
import "../lib/dappsys/erc20.sol";


contract Vesting is DSMath {
  Token public token;
  address public colonyMultiSig;

  uint constant internal SECONDS_PER_MONTH = 2628000;

  event GrantAdded(address recipient, uint amount, uint startTime, uint vestingDuration, uint vestingCliff);
  event GrantRemoved(address recipient, uint amountVested, uint amountNotVested);
  event GrantTokensClaimed(address recipient, uint amountClaimed);

  struct Grant {
    uint amount;
    uint startTime;
    uint vestingDuration;
    uint vestingCliff;
    uint64 monthsClaimed;
    uint totalClaimed;
  }
  mapping (address => Grant) public tokenGrants;

  modifier onlyColonyMultiSig {
    require(msg.sender == colonyMultiSig);
    _;
  }

  modifier nonZeroAddress(address x) {
    require(x != 0);
    _;
  }

  modifier noGrantExistsForUser(address _user) {
    require(tokenGrants[_user].startTime == 0);
    _;
  }

  function Vesting(address _token, address _colonyMultiSig) public
  nonZeroAddress(_token)
  nonZeroAddress(_colonyMultiSig)
  {
    token = Token(_token);
    colonyMultiSig = _colonyMultiSig;
  }

  /// @notice Add a new token grant for user `_recipient`. Only one grant per user is allowed
  /// The amount of CLNY tokens here need to be preapproved for transfer by this `Vesting` contract before this call
  /// Secured to the Colony MultiSig only
  /// @param _recipient Address of the token grant repipient entitled to claim the grant funds
  /// @param _amount Total number of tokens in grant
  /// @param _startTime Grant start time as seconds since unix epoch
  /// Allows backdating grants by passing time in the past. If `0` is passed here current blocktime is used. 
  /// @param _vestingDuration Number of months of the grant's duration
  /// @param _vestingCliff Number of months of the grant's vesting cliff
  function addTokenGrant(address _recipient, uint _amount, uint _startTime, uint _vestingDuration, uint _vestingCliff) public 
  onlyColonyMultiSig
  noGrantExistsForUser(_recipient)
  {
    require(_vestingCliff > 0);
    require(_vestingDuration > _vestingCliff);
    uint amountVestedPerMonth = _amount / _vestingDuration;
    require(amountVestedPerMonth > 0);

    // Transfer the grant tokens under the control of the vesting contract
    token.transferFrom(colonyMultiSig, address(this), _amount);

    Grant memory grant = Grant({
      amount: _amount,
      startTime: _startTime == 0 ? now : _startTime,
      vestingDuration: _vestingDuration,
      vestingCliff: _vestingCliff,
      monthsClaimed: 0,
      totalClaimed: 0
    });

    tokenGrants[_recipient] = grant;
    emit GrantAdded(_recipient, _amount, now, _vestingDuration, _vestingCliff);
  }

  /// @notice Terminate token grant transferring all vested tokens to the `_recipient`
  /// and returning all non-vested tokens to the Colony MultiSig
  /// Secured to the Colony MultiSig only
  /// @param _recipient Address of the token grant repipient
  function removeTokenGrant(address _recipient) public 
  onlyColonyMultiSig
  {
    Grant storage tokenGrant = tokenGrants[_recipient];
    uint elapsedMonths;
    uint amountVested;
    (elapsedMonths, amountVested) = calculateGrantClaim(_recipient);
    uint amountNotVested = sub(tokenGrant.amount, amountVested);

    token.transfer(_recipient, amountVested);
    token.transfer(colonyMultiSig, amountNotVested);

    tokenGrant.amount = 0;
    tokenGrant.startTime = 0;
    tokenGrant.vestingDuration = 0;
    tokenGrant.vestingCliff = 0;
    tokenGrant.monthsClaimed = 0;
    tokenGrant.totalClaimed = 0;

    emit GrantRemoved(_recipient, amountVested, amountNotVested);
  }

  /// @notice Allows a grant recipient to claim their vested tokens. Errors if no tokens have vested
  /// It is adviced recipients check they are entitled to claim via `calculateGrantClaim` before calling this
  function claimVestedTokens() public {
    uint elapsedMonths;
    uint amountVested;
    (elapsedMonths, amountVested) = calculateGrantClaim(msg.sender);
    require(amountVested > 0);

    Grant storage tokenGrant = tokenGrants[msg.sender];
    tokenGrant.monthsClaimed = uint64(elapsedMonths);
    tokenGrant.totalClaimed = add(tokenGrant.totalClaimed, amountVested);
    
    token.transfer(msg.sender, amountVested);
    emit GrantTokensClaimed(msg.sender, amountVested);
  }

  /// @notice Calculate the vested months and vested tokens for `_recepient`
  /// Due to rounding errors once grant duration is reached, returns the entire left grant amount
  /// Returns (0, 0) if cliff has not been reached
  function calculateGrantClaim(address _recipient) public view returns (uint256, uint256) {
    Grant storage tokenGrant = tokenGrants[_recipient];

    // Check cliff was reached
    uint elapsedTime = sub(now, tokenGrant.startTime);
    uint64 elapsedMonths = uint64(elapsedTime / SECONDS_PER_MONTH);
    
    if (elapsedMonths < tokenGrant.vestingCliff) {
      return (elapsedMonths, 0);
    }

    // If over vesting duration, all tokens vested
    if (elapsedMonths >= tokenGrant.vestingDuration) {
      uint remainingGrant = sub(tokenGrant.amount, tokenGrant.totalClaimed);
      return (tokenGrant.vestingDuration, remainingGrant);
    } else {
      uint64 monthsPendingClaim = uint64(sub(elapsedMonths, tokenGrant.monthsClaimed));
      // Calculate vested tokens and transfer them to recipient
      uint amountVestedPerMonth = tokenGrant.amount / tokenGrant.vestingDuration;
      uint amountVested = mul(monthsPendingClaim, amountVestedPerMonth);
      return (elapsedMonths, amountVested);
    }
  }
}
