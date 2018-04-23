![Colony Logo](https://user-images.githubusercontent.com/9886144/31672259-f9586cc4-b353-11e7-97fd-486069cbd256.png)

# Colony Token and Vesting contracts

## About

This is the repository for the Colony token and Token Vesting contracts.

The contracts contained in this repo have been released under a GPL-3.0 license. 

It should go without saying, but the code contained herein is designed to handle potentially large amounts of Ether, and as such should be deployed at your own risk and sole responsibility.  

If you've found a bug, please reach out to us here on github or by [email](mailto:hello@colony.io).

## Install

```
git clone https://github.com/JoinColony/colonySale.git
cd colonySale
yarn
git submodule update --init
```

## Contracts

The CLNY Token contract is defined in contracts/Token.sol

The Token grants are defined and managed in contracts/Vesting.sol

The `math`, `erc20` and a significant part of the `token` contracts have been reused from the [Dappsys library](https://github.com/dapphub/dappsys).

The Colony Multisignature contract is defined in gnosis/MultiSigWallet.sol and based on the [Gnosis MultiSig](https://github.com/gnosis/MultiSigWallet)

## Testing

To run all tests:
```
gulp test:contracts
```
To run tests with code coverage using [solidity-coverage](https://github.com/sc-forks/solidity-coverage):
```
gulp test:contracts:coverage
```
To lint contracts using [Solium](https://github.com/duaraghav8/Solium)
```
gulp lint:contracts
```
