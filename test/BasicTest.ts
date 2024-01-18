import { ethers } from 'hardhat';
import { expect } from 'chai';
import { Contract } from 'ethers';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { defaultAbiCoder } from '@ethersproject/abi';
import { impersonateAccount, setBalance } from '@nomicfoundation/hardhat-network-helpers';

import { MockAuthorizerAdaptorEntrypoint } from '../typechain/test/MockAuthorizerAdaptorEntrypoint';  
import { TestToken } from '../typechain/test/TestToken';  
import { BasicWeightedPool } from '../typechain';

import { Vault } from '../typechain/Vault';     
import { ProtocolFeePercentagesProvider } from '../typechain/ProtocolFeePercentagesProvider';
import { BasicWeightedPool__factory } from '../typechain/factories/BasicWeightedPool__factory';      
import { ProtocolFeePercentagesProvider__factory } from '../typechain/factories/ProtocolFeePercentagesProvider__factory';     
import { MockAuthorizerAdaptorEntrypoint__factory } from '../typechain/factories/test/MockAuthorizerAdaptorEntrypoint__factory';     
import { TimelockAuthorizer__factory } from '../typechain/factories/authorizer/TimelockAuthorizer__factory';     
import { Vault__factory } from '../typechain/factories/Vault__factory';       

import { toNormalizedWeights } from '../balancer-js/dist/index';
import { MAX_UINT256, ZERO_ADDRESS } from '../pvt/helpers/src/constants';
import { BigNumberish, fp, fpMul, bn} from '../pvt/helpers/src/numbers';
import { MONTH } from '../pvt/helpers/src/time';
import TokenList from '../pvt/helpers/src/models/tokens/TokenList';
import {SingleSwap, SwapKind, FundManagement, JoinPoolRequest, WeightedPoolEncoder} from '../balancer-js/dist/index';

const NAME = 'Basic Balancer Pool Token';
const SYMBOL = 'BPT';
const POOL_SWAP_FEE_PERCENTAGE = fp(0.01);

const numTokens = 3;
const WEIGHTS = toNormalizedWeights([fp(30), fp(70), fp(5), fp(5)].slice(0, numTokens));
const INITIAL_BALANCES = [fp(0.9), fp(1.8), fp(2.7), fp(3.6)];
const TOKEN_SYMBOLS = ['MKR', 'DAI', 'SNX', 'BAT'].slice(0, numTokens)
const weights: BigNumberish[] = WEIGHTS.slice(0, numTokens);
const initialBalances = INITIAL_BALANCES.slice(0, numTokens);
const MAX_AUM_VALUE = fp(0.2);
const MAX_YIELD_VALUE = fp(0.8);


const BASE_PAUSE_WINDOW_DURATION = MONTH * 3;
const BASE_BUFFER_PERIOD_DURATION = MONTH;

let tokens: TokenList;
let allTokens: TokenList;
let lp: SignerWithAddress;
let deployer: SignerWithAddress;
let recipient: SignerWithAddress;
let vaultSigner: SignerWithAddress;
let admin: SignerWithAddress;
let weightedPool: BasicWeightedPool;
let authorizer: Contract;
let feesProvider: ProtocolFeePercentagesProvider;
let vault: Vault;
let entrypoint: MockAuthorizerAdaptorEntrypoint;

function getHardhatTimeout(): number {
  const hre: HardhatRuntimeEnvironment = require('hardhat');
  return hre.config.mocha.timeout || 2000; // Default to 2000ms if not specified
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
    allTokens = await TokenList.create(TOKEN_SYMBOLS, { sorted: true });
    await allTokens.mint({ to: lp, amount: tokenAmounts });
    await allTokens.approve({ to: vault.address, from: lp, amount: tokenAmounts }); 
    tokens = allTokens.subset(numTokens);
}  

async function protocolFeeProvider(): Promise<void> {
    feesProvider = await new ProtocolFeePercentagesProvider__factory(deployer).deploy(vault.address, 
                                                                                        MAX_YIELD_VALUE, 
                                                                                        MAX_AUM_VALUE);
} 

async function deployRawWeightedPoolContract(): Promise<void>  {
    console.log('     Deploying WeightedPool ...');  
    let null_addr_arr:string[] = [ZERO_ADDRESS,ZERO_ADDRESS,ZERO_ADDRESS]
  
    const pool_params =  {
      name: NAME,
      symbol: SYMBOL,
      tokens: tokens.addresses,
      normalizedWeights: weights,
      rateProviders: null_addr_arr,
      assetManagers: null_addr_arr,
      swapFeePercentage: POOL_SWAP_FEE_PERCENTAGE,
    };
                                
    weightedPool = await new BasicWeightedPool__factory(deployer).deploy(pool_params,
                                                vault.address, 
                                                feesProvider.address,
                                                BASE_PAUSE_WINDOW_DURATION, 
                                                BASE_BUFFER_PERIOD_DURATION,
                                                recipient.address); 
                                                                                                                         
  } 

  async function initRawJoin(): Promise<void> {
    const joinKind = 0;
    const abi = ['uint256', 'uint256[]'];
    const data = [joinKind, initialBalances];
    const userData = defaultAbiCoder.encode(abi,data); 
    const poolId = await weightedPool.getPoolId();
  
    const request: JoinPoolRequest = {
      assets: tokens.addresses,
      maxAmountsIn: initialBalances,
      userData: userData,
      fromInternalBalance: false,
    };
  
    const tx = await vault.connect(lp).joinPool(poolId, lp.address, recipient.address, request);
  }

  async function rawSwapVault(): Promise<void> {

    const poolId = await weightedPool.getPoolId();
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
    const poolId = await weightedPool.getPoolId();
    const poolTokens = await vault.getPoolTokens(poolId)
  
    let message: string = "\n        Weighted pool info: " + context + "+\n";
    message = message + '        ------------------------\n'
    message = message + '        vault address: '+await vault.address+'\n'
    message = message + '        balances: '+ await poolTokens.balances +'\n'
    message = message + '        tkn addresses: '+ await poolTokens.tokens +'\n'
    message = message + '        ------------------------\n'
    console.log(message);  
  
  }    
    
before('setup signers', async () => {
    [ ,admin, lp, recipient, deployer] = await ethers.getSigners();
});  

describe("BasicWeightedPool", function() {
    this.timeout(getHardhatTimeout());
    context('Engage factory contract BasicWeightedPool.sol', () => {
      
      it('swap given in', async () => {
        expect(true);
        await deployRawVault()
        await deployTokens();
        await protocolFeeProvider();
        await deployRawWeightedPoolContract();
        await initRawJoin();        
        await poolInfo('post join');
        await rawSwapVault();
        await poolInfo('post swap');
      });           
   
    }); 
});      



