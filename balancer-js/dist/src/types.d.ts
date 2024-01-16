import { BigNumberish } from '@ethersproject/bignumber';
export declare enum PoolSpecialization {
    GeneralPool = 0,
    MinimalSwapInfoPool = 1,
    TwoTokenPool = 2
}
export type FundManagement = {
    sender: string;
    fromInternalBalance: boolean;
    recipient: string;
    toInternalBalance: boolean;
};
export declare enum SwapKind {
    GivenIn = 0,
    GivenOut = 1
}
export type SingleSwap = {
    poolId: string;
    kind: SwapKind;
    assetIn: string;
    assetOut: string;
    amount: BigNumberish;
    userData: string;
};
export type Swap = {
    kind: SwapKind;
    singleSwap: SingleSwap;
    limit: BigNumberish;
    deadline: BigNumberish;
};
export type BatchSwapStep = {
    poolId: string;
    assetInIndex: number;
    assetOutIndex: number;
    amount: BigNumberish;
    userData: string;
};
export type BatchSwap = {
    kind: SwapKind;
    swaps: BatchSwapStep[];
    assets: string[];
    funds: FundManagement;
    limits: BigNumberish[];
    deadline: BigNumberish;
};
export type SwapRequest = {
    kind: SwapKind;
    tokenIn: string;
    tokenOut: string;
    amount: BigNumberish;
    poolId: string;
    lastChangeBlock: BigNumberish;
    from: string;
    to: string;
    userData: string;
};
export type JoinPoolRequest = {
    assets: string[];
    maxAmountsIn: BigNumberish[];
    userData: string;
    fromInternalBalance: boolean;
};
export type ExitPoolRequest = {
    assets: string[];
    minAmountsOut: BigNumberish[];
    userData: string;
    toInternalBalance: boolean;
};
export declare enum UserBalanceOpKind {
    DepositInternal = 0,
    WithdrawInternal = 1,
    TransferInternal = 2,
    TransferExternal = 3
}
export type UserBalanceOp = {
    kind: UserBalanceOpKind;
    asset: string;
    amount: BigNumberish;
    sender: string;
    recipient: string;
};
export declare enum PoolBalanceOpKind {
    Withdraw = 0,
    Deposit = 1,
    Update = 2
}
export type PoolBalanceOp = {
    kind: PoolBalanceOpKind;
    poolId: string;
    token: string;
    amount: BigNumberish;
};
export declare enum GaugeType {
    Ethereum = 0,
    Polygon = 1,
    Arbitrum = 2,
    Optimism = 3,
    Gnosis = 4,
    Avalanche = 5,
    PolygonZKEvm = 6,
    ZkSync = 7
}
