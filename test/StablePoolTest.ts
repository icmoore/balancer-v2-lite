import { expect } from 'chai';
import { ethers } from 'hardhat';
import { Contract } from 'ethers';
import { HardhatRuntimeEnvironment } from "hardhat/types/runtime";
import { impersonateAccount, setBalance } from '@nomicfoundation/hardhat-network-helpers';
import { defaultAbiCoder } from '@ethersproject/abi';

import { getArtifact } from '../pvt/helpers/src/contract';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address';
import { SingleSwap, FundManagement, SwapKind, JoinPoolRequest } from '../balancer-js/';

import { BigNumberish, fpMul, fp, FP_ONE, FP_ZERO} from '../pvt/helpers/src/numbers';
import { MAX_UINT256, ZERO_ADDRESS } from '../pvt/helpers/src/constants';
import {  MONTH } from '../pvt/helpers/src/time';
import TokenList from '../pvt/helpers/src/models/tokens/TokenList';
import TypesConverter from '../pvt/helpers/src/models/types/TypesConverter';
import { ComposableStablePool } from '../typechain';
import { Vault } from '../typechain/Vault';    
import { MockAuthorizerAdaptorEntrypoint } from '../typechain/test/MockAuthorizerAdaptorEntrypoint';  
import { ProtocolFeePercentagesProvider } from '../typechain/ProtocolFeePercentagesProvider';
import { MockAuthorizerAdaptorEntrypoint__factory } from '../typechain/factories/test/MockAuthorizerAdaptorEntrypoint__factory';     
import { TimelockAuthorizer__factory } from '../typechain/factories/authorizer/TimelockAuthorizer__factory'; 
import { Vault__factory } from '../typechain/factories/Vault__factory';    
import { ComposableStablePool__factory } from '../typechain/factories/stable-pool/ComposableStablePool__factory';
import { ProtocolFeePercentagesProvider__factory } from '../typechain/factories/ProtocolFeePercentagesProvider__factory';    

const numTokens = 3;
let lp: SignerWithAddress;
let owner: SignerWithAddress;
let deployer: SignerWithAddress;
let recipient: SignerWithAddress;
let vaultSigner: SignerWithAddress;
let other: SignerWithAddress;
let admin: SignerWithAddress;
let authorizer: Contract;
let initialBalances: BigNumberish[];
let bptIndex: number;
let tokens: TokenList;
let vault: Vault;
let feesProvider: ProtocolFeePercentagesProvider;
let entrypoint: MockAuthorizerAdaptorEntrypoint;
let composableStableFactory: ComposableStablePool;

const NAME = 'Balancer Pool Token';
const SYMBOL = 'BPT';
const VERSION = 'test';
const POOL_SWAP_FEE_PERCENTAGE = fp(0.01);
const TOKEN_SYMBOLS = ['USDC', 'DAI', 'USDT', 'BUSD'].slice(0, numTokens)
const BASE_PAUSE_WINDOW_DURATION = MONTH * 3;
const BASE_BUFFER_PERIOD_DURATION = MONTH;
const MAX_AUM_VALUE = fp(0.2);
const MAX_YIELD_VALUE = fp(0.8);
const DEFAUT_TIMEOUT = 2000;

function getHardhatTimeout(): number {
  const hre: HardhatRuntimeEnvironment = require('hardhat');
  const timeout = hre.config.mocha.timeout as number
  return timeout || DEFAUT_TIMEOUT;  // Default to 2000ms
}

async function deployRawVault(): Promise<void>  {
  entrypoint = await new MockAuthorizerAdaptorEntrypoint__factory(deployer).deploy()
  authorizer = await new TimelockAuthorizer__factory(deployer).deploy(admin.address, ZERO_ADDRESS, entrypoint.address, MONTH)
  vault = await new Vault__factory(deployer).deploy(authorizer.address, ZERO_ADDRESS, 0, 0)
  await impersonateAccount(vault.address);
  await setBalance(vault.address, fp(100));
  vaultSigner = await SignerWithAddress.create(ethers.provider.getSigner(vault.address));
}

async function deployTokens(): Promise<void> {
    const tokenAmounts = fp(100);
    tokens = await TokenList.create(TOKEN_SYMBOLS, { sorted: true });
    await tokens.mint({ to: lp, amount: tokenAmounts });
    await tokens.approve({ to: vault.address, from: lp, amount: tokenAmounts }); 
} 

async function protocolFeeProvider(): Promise<void> {
  feesProvider = await new ProtocolFeePercentagesProvider__factory(deployer).deploy(vault.address, 
                                                                                      MAX_YIELD_VALUE, 
                                                                                      MAX_AUM_VALUE);
} 

async function deployRawPoolContract(): Promise<void>  {
  console.log('     Deploying Raw Pool Contract ...');  

  const rates: BigNumberish[] = [];
  const rateProviders: Contract[] = [];
  const tokenRateCacheDurations: number[] = [];
  const exemptFromYieldProtocolFeeFlags: boolean[] = [];

  for (let i = 0; i < numTokens; i++) {
    const artifact = await getArtifact('MockRateProvider');
    const factory = new ethers.ContractFactory(artifact.abi, artifact.bytecode, other);
    rateProviders[i] = await factory.deploy();

    await rateProviders[i].mockRate(rates[i] || FP_ONE);
    tokenRateCacheDurations[i] = MONTH + i;
    exemptFromYieldProtocolFeeFlags[i] = i % 2 == 0; // set true for even tokens
  }  

  const pool_params =  {
    vault: vault.address,
    protocolFeeProvider: feesProvider.address,
    name: NAME,
    symbol: SYMBOL,
    tokens: tokens.addresses,
    rateProviders: TypesConverter.toAddresses(rateProviders),
    tokenRateCacheDurations: tokenRateCacheDurations,
    exemptFromYieldProtocolFeeFlags: exemptFromYieldProtocolFeeFlags,
    amplificationParameter: 200,    
    swapFeePercentage: POOL_SWAP_FEE_PERCENTAGE,        
    pauseWindowDuration: BASE_PAUSE_WINDOW_DURATION,         
    bufferPeriodDuration: BASE_BUFFER_PERIOD_DURATION,   
    owner: recipient.address,
    version: VERSION,         
  };

  composableStableFactory = await new ComposableStablePool__factory(deployer).deploy(pool_params)                                                                                                                                       
} 


async function initRawJoin(): Promise<void> {
  bptIndex = 0
  initialBalances = Array.from({ length: numTokens + 1 }).map((_, i) => (i == bptIndex ? fp(2596148429267412): fp(1 - i / 10)));  
  const joinKind = 0;
  const abi = ['uint256', 'uint256[]'];
  const data = [joinKind, initialBalances];
  const userData = defaultAbiCoder.encode(abi,data); 
  const poolId = await composableStableFactory.getPoolId();
  const poolTokens = await vault.getPoolTokens(poolId)

  const request: JoinPoolRequest = {
    assets: poolTokens.tokens,
    maxAmountsIn: initialBalances,
    userData: userData,
    fromInternalBalance: false
  };  

  const tx = await vault.connect(lp).joinPool(poolId, lp.address, recipient.address, request);
}


async function rawSwapVault(): Promise<void> {

  const poolId = await composableStableFactory.getPoolId();
  const amount = fp(0.1);
  const amountWithFees = fpMul(amount, POOL_SWAP_FEE_PERCENTAGE.add(fp(1)));

  const singleSwap: SingleSwap = {
    poolId: poolId,
    kind: SwapKind.GivenIn,
    assetIn: tokens.get(1).instance.address,
    assetOut: tokens.get(0).instance.address,
    amount: amountWithFees, // Needs to be > 0
    userData: '0x',
  };

  const funds: FundManagement = {
    sender: lp.address,
    recipient: recipient.address,
    fromInternalBalance: false,
    toInternalBalance: false,
  };

  const tx = await vault.connect(lp).swap(singleSwap, funds, 0, MAX_UINT256)
}


async function poolInfo(context: string): Promise<void> {
  const poolId = await composableStableFactory.getPoolId();
  const poolTokens = await vault.getPoolTokens(poolId)

  let message: string = "\n        Stable pool info: " + context + "+\n";
  message = message + '        ------------------------\n'
  message = message + '        vault address: '+await vault.address+'\n'
  message = message + '        balances: '+ await poolTokens.balances +'\n'
  message = message + '        tkn addresses: '+ await poolTokens.tokens +'\n'
  message = message + '        ------------------------\n'
  console.log(message);  

}  

before('setup signers', async () => {
  [, lp, owner, recipient, admin, deployer, other] = await ethers.getSigners();
});

describe("ComposableStablePool", function() {
   this.timeout(getHardhatTimeout());
   context('Engage factory contract ComposableStablePool.sol', () => {

    it('swap given in', async () => {
      expect(true);
      await deployRawVault();
      await deployTokens();
      await protocolFeeProvider();
      await deployRawPoolContract();
      await initRawJoin();
      await poolInfo('post join');
      await rawSwapVault();
      await poolInfo('post swap');
    });   

  }); 

});    




