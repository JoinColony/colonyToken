pragma solidity ^0.4.23;
pragma experimental "v0.5.0";


import "../lib/dappsys/auth.sol";
import "../lib/dappsys/math.sol";
import "./ERC20Extended.sol";


contract Token is DSAuth, DSMath, ERC20Extended {
  bytes32 public symbol;
  uint256 public decimals;
  bytes32 public name;

  uint256 _supply;
  mapping (address => uint256) _balances;
  mapping (address => mapping (address => uint256)) _approvals;
  bool public locked;

  constructor(bytes32 _name, bytes32 _symbol, uint256 _decimals) public {
    name = _name;
    symbol = _symbol;
    decimals = _decimals;
    locked = true;
  }

  modifier unlocked {
    if (locked) {
      require(isAuthorized(msg.sender, msg.sig));
    }
    _;
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
    return transferFrom(msg.sender, dst, wad);
  }

  function transferFrom(address src, address dst, uint wad) public
  unlocked
  returns (bool)
  {
    if (src != msg.sender) {
      _approvals[src][msg.sender] = sub(_approvals[src][msg.sender], wad);
    }

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

    emit Mint(msg.sender, wad);
  }

  function unlock() public
  auth
  {
    require(locked);
    locked = false;
  }
}
