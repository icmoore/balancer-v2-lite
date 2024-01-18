# Balancer V2 Lite

Bare bones starter kit implementation of [Balancer v2 Core](https://github.com/balancer/balancer-v2-monorepo); compile solidity from scratch and use 
[typechain](https://www.npmjs.com/package/typechain) for testing; useful for core devs who wish to streamline their project to work directly with raw solidity and not 
rely on pre-compiled balancer v2 npm libraries

Basic usage include:
* deploy vault
* deploy test tokens
* protocol fee provider
* weighted pool factory
* initial token join
* swapgivenin / swapgivenout

## Overview

### Installation

```console
$ yarn                                # install dev dependencies
$ yarn build                          # compile solidity
```

### Usage

Sample Weighted Pool with immutable weights

```
$ yarn test test/BasicTest.ts         # run basic test template
```

### Tutorials
I.Moore, [How to Create a Weighted Pool with Balancer v2 Lite](https://medium.com/coinmonks/onboarding-with-balancer-v2-lite-5e3b9c2c8824), Coinmonks, Jan 2024.

## Licensing

[GNU General Public License Version 3 (GPL v3)](../../LICENSE).
