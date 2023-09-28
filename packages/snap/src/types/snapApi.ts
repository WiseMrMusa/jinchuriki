import { BIP44AddressKeyDeriver } from '@metamask/key-tree';
import Mutex from 'async-mutex/lib/Mutex';
import { SnapState, VoyagerTransactionType } from './snapState';

export type ApiParams = {
  state: SnapState;
  requestParams: ApiRequestParams;
  saveMutex: Mutex;
  wallet;
  keyDeriver?: BIP44AddressKeyDeriver;
};

export type ApiRequestParams =
  | CreateAccountRequestParams
  | GetStoredUserAccountsRequestParams
  | ExtractPrivateKeyRequestParams
  | ExtractPublicKeyRequestParams
  | SignMessageRequestParams
  | VerifySignedMessageRequestParams
  | GetErc20TokenBalanceRequestParams
  | GetTransactionStatusRequestParams
  | SendTransactionRequestParams
  | GetValueRequestParams
  | EstimateFeeRequestParams
  | EstimateAccountDeployFeeRequestParams
  | AddErc20TokenRequestParams
  | GetStoredErc20TokensRequestParams
  | AddNetworkRequestParams
  | GetStoredNetworksRequestParams
  | GetStoredTransactionsRequestParams
  | GetTransactionsRequestParams
  | RecoverAccountsRequestParams;

export type BaseRequestParams = {
  chainId?: string;
  isDev?: boolean;
  debugLevel?: string;
};

export type CreateAccountRequestParams = {
  addressIndex?: string | number;
  deploy?: boolean;
} & BaseRequestParams;

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export type GetStoredUserAccountsRequestParams = {} & BaseRequestParams;

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export type GetStoredErc20TokensRequestParams = {} & BaseRequestParams;

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export type GetStoredNetworksRequestParams = {} & Omit<
  BaseRequestParams,
  'chainId'
>;

export type ExtractPrivateKeyRequestParams = {
  userAddress: string;
} & BaseRequestParams;

export type ExtractPublicKeyRequestParams = {
  userAddress: string;
} & BaseRequestParams;

export type SignMessageRequestParams = {
  signerAddress: string;
  typedDataMessage?: string;
} & BaseRequestParams;

export type VerifySignedMessageRequestParams = {
  signerAddress: string;
  signature: string;
  typedDataMessage?: string;
} & BaseRequestParams;

export type GetErc20TokenBalanceRequestParams = {
  tokenAddress: string;
  userAddress: string;
} & BaseRequestParams;

export type GetTransactionStatusRequestParams = {
  transactionHash: string;
} & BaseRequestParams;

export type SendTransactionRequestParams = {
  contractAddress: string;
  contractFuncName: string;
  contractCallData?: string;
  senderAddress: string;
  maxFee?: string;
} & BaseRequestParams;

export type GetValueRequestParams = {
  contractAddress: string;
  contractFuncName: string;
  contractCallData?: string;
} & BaseRequestParams;

export type EstimateFeeRequestParams = {
  contractAddress: string;
  contractFuncName: string;
  contractCallData?: string;
  senderAddress: string;
} & BaseRequestParams;

export type EstimateAccountDeployFeeRequestParams = {
  addressIndex?: string | number;
} & BaseRequestParams;

export type AddErc20TokenRequestParams = {
  tokenAddress: string;
  tokenName: string;
  tokenSymbol: string;
  tokenDecimals?: string | number;
} & BaseRequestParams;

export type AddNetworkRequestParams = {
  networkName: string;
  networkChainId: string;
  networkBaseUrl: string;
  networkNodeUrl: string;
  networkVoyagerUrl?: string;
  accountClassHash?: string;
} & BaseRequestParams;

export type GetStoredTransactionsRequestParams = {
  senderAddress?: string;
  contractAddress?: string;
  txnType?: VoyagerTransactionType | string;
  txnsInLastNumOfDays?: string | number;
} & BaseRequestParams;

export type GetTransactionsRequestParams = {
  senderAddress?: string;
  contractAddress?: string;
  pageSize?: string | number;
  txnsInLastNumOfDays?: string | number;
  onlyFromState?: boolean;
  withDeployTxn?: boolean;
} & BaseRequestParams;

export type RecoverAccountsRequestParams = {
  startScanIndex?: string | number;
  maxScanned?: string | number;
  maxMissed?: string | number;
} & BaseRequestParams;

export type RpcV4GetTransactionReceiptResponse = {
  execution_status?: string;
  finality_status?: string;
};
