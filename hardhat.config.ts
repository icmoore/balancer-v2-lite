import '@nomiclabs/hardhat-ethers';
import '@nomiclabs/hardhat-waffle';
import 'hardhat-ignore-warnings';
import "@typechain/hardhat";

import { hardhatBaseConfig } from './pvt/common/index';
import { name } from './package.json';

import { task } from 'hardhat/config';
import { TASK_COMPILE } from 'hardhat/builtin-tasks/task-names';


export default {
  networks: {
    hardhat: {
      allowUnlimitedContractSize: true,  
    },
  },
  solidity: {
    compilers: hardhatBaseConfig.compilers,
    overrides: { ...hardhatBaseConfig.overrides(name) },
  },
  typechain: {
    alwaysGenerateOverloads: true,
    outDir: 'typechain',
  }, 
  warnings: hardhatBaseConfig.warnings,
};
