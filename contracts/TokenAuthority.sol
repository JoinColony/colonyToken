/*
  This file is part of The Colony Network.

  The Colony Network is free software: you can redistribute it and/or modify
  it under the terms of the GNU General Public License as published by
  the Free Software Foundation, either version 3 of the License, or
  (at your option) any later version.

  The Colony Network is distributed in the hope that it will be useful,
  but WITHOUT ANY WARRANTY; without even the implied warranty of
  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
  GNU General Public License for more details.

  You should have received a copy of the GNU General Public License
  along with The Colony Network. If not, see <http://www.gnu.org/licenses/>.
*/

pragma solidity ^0.4.23;

import "../lib/dappsys/auth.sol";


contract TokenAuthority is DSAuthority {
  address public token;
  mapping(address => mapping(bytes4 => bool)) authorizations;
  
  constructor(address _token, address _vesting, address _metaColony, address _tokenLocking) public {
    token = _token;
    bytes4 transferSig = bytes4(keccak256("transfer(address,uint256)"));
    bytes4 transferFromSig = bytes4(keccak256("transferFrom(address,address,uint256)"));
    bytes4 mintSig = bytes4(keccak256("mint(uint256)"));

    authorizations[_vesting][transferSig] = true;
    authorizations[_vesting][transferFromSig] = true;

    authorizations[_metaColony][transferSig] = true;        // Used in IColony: bootstrapColony, mintTokensForColonyNetwork,
                                                            // claimPayout and claimRewardPayout
    authorizations[_metaColony][mintSig] = true;            // Used in IColony.mintTokensForColonyNetwork

    authorizations[_tokenLocking][transferSig] = true;     // Used in ITokenLocking.withdraw
    authorizations[_tokenLocking][transferFromSig] = true; // Used in ITokenLocking.deposit
  }

  function canCall(address src, address dst, bytes4 sig) public view returns (bool) {
    if (dst != token) {
      return false;
    }
    
    return authorizations[src][sig];
  }
}