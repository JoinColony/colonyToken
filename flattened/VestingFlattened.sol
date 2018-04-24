pragma solidity ^0.4.13;

contract DSAuthority {
    function canCall(
        address src, address dst, bytes4 sig
    ) public view returns (bool);
}

contract DSAuthEvents {
    event LogSetAuthority (address indexed authority);
    event LogSetOwner     (address indexed owner);
}

contract DSAuth is DSAuthEvents {
    DSAuthority  public  authority;
    address      public  owner;

    function DSAuth() public {
        owner = msg.sender;
        LogSetOwner(msg.sender);
    }

    function setOwner(address owner_)
        public
        auth
    {
        owner = owner_;
        LogSetOwner(owner);
    }

    function setAuthority(DSAuthority authority_)
        public
        auth
    {
        authority = authority_;
        LogSetAuthority(authority);
    }

    modifier auth {
        require(isAuthorized(msg.sender, msg.sig));
        _;
    }

    function isAuthorized(address src, bytes4 sig) internal view returns (bool) {
        if (src == address(this)) {
            return true;
        } else if (src == owner) {
            return true;
        } else if (authority == DSAuthority(0)) {
            return false;
        } else {
            return authority.canCall(src, this, sig);
        }
    }
}

contract ERC20Events {
    event Approval(address indexed src, address indexed guy, uint wad);
    event Transfer(address indexed src, address indexed dst, uint wad);
}

contract ERC20 is ERC20Events {
    function totalSupply() public view returns (uint);
    function balanceOf(address guy) public view returns (uint);
    function allowance(address src, address guy) public view returns (uint);

    function approve(address guy, uint wad) public returns (bool);
    function transfer(address dst, uint wad) public returns (bool);
    function transferFrom(
        address src, address dst, uint wad
    ) public returns (bool);
}

contract ERC20Extended is ERC20 {
  function mint(uint wad) public;
}

contract DSMath {
    function add(uint x, uint y) internal pure returns (uint z) {
        require((z = x + y) >= x);
    }
    function sub(uint x, uint y) internal pure returns (uint z) {
        require((z = x - y) <= x);
    }
    function mul(uint x, uint y) internal pure returns (uint z) {
        require(y == 0 || (z = x * y) / y == x);
    }

    function min(uint x, uint y) internal pure returns (uint z) {
        return x <= y ? x : y;
    }
    function max(uint x, uint y) internal pure returns (uint z) {
        return x >= y ? x : y;
    }
    function imin(int x, int y) internal pure returns (int z) {
        return x <= y ? x : y;
    }
    function imax(int x, int y) internal pure returns (int z) {
        return x >= y ? x : y;
    }

    uint constant WAD = 10 ** 18;
    uint constant RAY = 10 ** 27;

    function wmul(uint x, uint y) internal pure returns (uint z) {
        z = add(mul(x, y), WAD / 2) / WAD;
    }
    function rmul(uint x, uint y) internal pure returns (uint z) {
        z = add(mul(x, y), RAY / 2) / RAY;
    }
    function wdiv(uint x, uint y) internal pure returns (uint z) {
        z = add(mul(x, WAD), y / 2) / y;
    }
    function rdiv(uint x, uint y) internal pure returns (uint z) {
        z = add(mul(x, RAY), y / 2) / y;
    }

    // This famous algorithm is called "exponentiation by squaring"
    // and calculates x^n with x as fixed-point and n as regular unsigned.
    //
    // It's O(log n), instead of O(n) for naive repeated multiplication.
    //
    // These facts are why it works:
    //
    //  If n is even, then x^n = (x^2)^(n/2).
    //  If n is odd,  then x^n = x * x^(n-1),
    //   and applying the equation for even x gives
    //    x^n = x * (x^2)^((n-1) / 2).
    //
    //  Also, EVM division is flooring and
    //    floor[(n-1) / 2] = floor[n / 2].
    //
    function rpow(uint x, uint n) internal pure returns (uint z) {
        z = n % 2 != 0 ? x : RAY;

        for (n /= 2; n != 0; n /= 2) {
            x = rmul(x, x);

            if (n % 2 != 0) {
                z = rmul(z, x);
            }
        }
    }
}

contract Token is DSAuth, DSMath, ERC20Extended {
  bytes32 public symbol;
  uint256 public decimals;
  bytes32 public name;

  uint256 _supply;
  mapping (address => uint256) _balances;
  mapping (address => mapping (address => uint256)) _approvals;

  function Token(bytes32 _name, bytes32 _symbol, uint256 _decimals) public {
    name = _name;
    symbol = _symbol;
    decimals = _decimals;
  }

  function totalSupply() public view returns (uint256) {
    return _supply;
  }

  function balanceOf(address src) public view returns (uint256) {
    return _balances[src];
  }

  function allowance(address src, address guy) public view returns (uint256) {
    return _approvals[src][guy];
  }

  function transfer(address dst, uint wad) public returns (bool) {
    assert(_balances[msg.sender] >= wad);

    _balances[msg.sender] = sub(_balances[msg.sender], wad);
    _balances[dst] = add(_balances[dst], wad);

    emit Transfer(msg.sender, dst, wad);

    return true;
  }

  function transferFrom(address src, address dst, uint wad) public returns (bool) {
    assert(_balances[src] >= wad);
    assert(_approvals[src][msg.sender] >= wad);

    _approvals[src][msg.sender] = sub(_approvals[src][msg.sender], wad);
    _balances[src] = sub(_balances[src], wad);
    _balances[dst] = add(_balances[dst], wad);

    emit Transfer(src, dst, wad);

    return true;
  }

  function approve(address guy, uint256 wad) public returns (bool) {
    _approvals[msg.sender][guy] = wad;

    emit Approval(msg.sender, guy, wad);

    return true;
  }

  function mint(uint wad) public
  auth
  {
    _balances[msg.sender] = add(_balances[msg.sender], wad);
    _supply = add(_supply, wad);
  }
}

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
    uint amountNotVested = sub(sub(tokenGrant.amount, tokenGrant.totalClaimed), amountVested);

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

