# Balancer V2 Lite

Bare bones implementation of [Balancer v2 Core](https://github.com/balancer/balancer-v2-monorepo); compile solidity from scratch and use typechain for testing; useful for 
core devs who wish to streamline their project to work directly with raw solidity and not rely on pre-compiled balancer v2 npm libraries

Basic usage include:
* deploy vault
* deploy test tokens
* protocol fee provider
* weighted pool factory
* initial token join
* swapping

## Overview

### Installation

```console
$ yarn
$ yarn build
```

### Usage

Sample Weighted Pool that computes weights dynamically on every swap, join and exit:

```
$ npm test test/BasicTest.ts
```

## Licensing

[GNU General Public License Version 3 (GPL v3)](../../LICENSE).
