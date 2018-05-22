pragma solidity ^0.4.23;

import "../lib/dappsys/auth.sol";


contract TokenAuthority is DSAuthority {
  address public token;
  mapping(address => mapping(bytes4 => bool)) authorizations;
  
  constructor(address _token, address _vesting) public {
    token = _token;
    bytes4 transferSig = bytes4(keccak256("transfer(address,uint256)"));
    bytes4 transferFromSig = bytes4(keccak256("transferFrom(address,address,uint256)"));

    authorizations[_vesting][transferSig] = true;
    authorizations[_vesting][transferFromSig] = true;
  }

  function canCall(address src, address dst, bytes4 sig) public view returns (bool) {
    if (dst != token) {
      return false;
    }
    
    return authorizations[src][sig];
  }
}