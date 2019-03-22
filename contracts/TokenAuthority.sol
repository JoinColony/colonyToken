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

pragma solidity >=0.5.3;

import "../lib/dappsys/auth.sol";


contract TokenAuthority is DSAuthority {
  address public token;
  mapping(address => mapping(bytes4 => bool)) authorizations;

  constructor(
    address _token,
    address _colonyNetwork,
    address _metaColony,
    address _tokenLocking,
    address _vesting,
    address[] memory miners,
    address _regulator) public {
    token = _token;
    bytes4 transferSig = bytes4(keccak256("transfer(address,uint256)"));
    bytes4 transferFromSig = bytes4(keccak256("transferFrom(address,address,uint256)"));
    bytes4 mintSig = bytes4(keccak256("mint(uint256)"));
    bytes4 mintSigOverload = bytes4(keccak256("mint(address,uint256)"));

    authorizations[_colonyNetwork][transferSig] = true;      // Used in IColonyNetworkMining.rewardStakers
    authorizations[_colonyNetwork][transferFromSig] = true;

    authorizations[_metaColony][transferSig] = true;        // Used in IColony: bootstrapColony, mintTokensForColonyNetwork,
                                                            // claimPayout and claimRewardPayout
    authorizations[_metaColony][mintSig] = true;            // Used in IColony.mintTokensForColonyNetwork
    authorizations[_metaColony][mintSigOverload] = true;            // Used in IColony.mintTokensForColonyNetwork

    authorizations[_tokenLocking][transferSig] = true;      // Used in ITokenLocking.withdraw
    authorizations[_tokenLocking][transferFromSig] = true;  // Used in ITokenLocking.deposit

    authorizations[_vesting][transferSig] = true;
    authorizations[_vesting][transferFromSig] = true;

    // Allow passing in of multiple reputation miner accounts although potentially one will be used in production
    for (uint i = 0; i < miners.length; i++) {
      address miner = miners[i];
      authorizations[miner][transferSig] = true;
    }

    authorizations[_regulator][transferFromSig] = true;
  }

  function canCall(address src, address dst, bytes4 sig) public view returns (bool) {
    bytes4 burnSig = bytes4(keccak256("burn(uint256)"));
    bytes4 burnSigOverload = bytes4(keccak256("burn(address,uint256)"));

    if (sig == burnSig || sig == burnSigOverload) {
      // We allow anyone to burn their own tokens even when CLNY is still locked
      return true;
    }

    if (dst != token) {
      return false;
    }

    return authorizations[src][sig];
  }
}
