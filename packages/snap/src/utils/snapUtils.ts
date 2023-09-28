import { Mutex } from 'async-mutex';
import { num } from 'starknet';
import { Component, text, copyable } from '@metamask/snaps-ui';
import convert from 'ethereum-unit-converter';
import {
  Network,
  Erc20Token,
  AccContract,
  SnapState,
  Transaction,
  VoyagerTransactionType,
  TransactionStatus,
} from '../types/snapState';
import {
  AddErc20TokenRequestParams,
  AddNetworkRequestParams,
} from '../types/snapApi';
import {
  MAXIMUM_NETWORK_NAME_LENGTH,
  MAXIMUM_TOKEN_NAME_LENGTH,
  MAXIMUM_TOKEN_SYMBOL_LENGTH,
  PRELOADED_NETWORKS,
  PRELOADED_TOKENS,
  STARKNET_TESTNET_NETWORK,
  VOYAGER_API_TXNS_URL_SUFFIX,
  VOYAGER_API_TXN_URL_SUFFIX,
} from './constants';
import { validateAndParseAddress } from './starknetUtils';
import { toJson } from './serializer';
import {
  filterTransactions,
  TimestampFilter,
  ContractAddressFilter,
  SenderAddressFilter,
  TxnTypeFilter,
  StatusFilter,
  ChainIdFilter,
} from './transaction/filter';
import { logger } from './logger';

/**
 *
 * @param str
 */
function hasOnlyAsciiChars(str: string) {
  return /^[ -~]+$/.test(str);
}

/**
 *
 * @param fieldStr
 * @param maxLength
 */
function isValidAsciiStrField(fieldStr: string, maxLength: number) {
  return (
    hasOnlyAsciiChars(fieldStr) &&
    fieldStr.trim().length > 0 &&
    fieldStr.length <= maxLength
  );
}

/**
 *
 * @param str
 */
function isHexWithPrefix(str: string) {
  return /^0x[0-9a-fA-F]+$/.test(str);
}

/**
 *
 * @param urlStr
 */
function isValidHttpUrl(urlStr: string) {
  let url: URL;
  try {
    url = new URL(urlStr);
  } catch (_) {
    return false;
  }
  return url.protocol === 'http:' || url.protocol === 'https:';
}

/**
 *
 * @param tokenName
 */
function isValidTokenName(tokenName: string) {
  return isValidAsciiStrField(tokenName, MAXIMUM_TOKEN_NAME_LENGTH);
}

/**
 *
 * @param tokenSymbol
 */
function isValidTokenSymbol(tokenSymbol: string) {
  return isValidAsciiStrField(tokenSymbol, MAXIMUM_TOKEN_SYMBOL_LENGTH);
}

/**
 *
 * @param networkName
 */
function isValidNetworkName(networkName: string) {
  return isValidAsciiStrField(networkName, MAXIMUM_NETWORK_NAME_LENGTH);
}

/**
 *
 * @param tokenName
 * @param chainId
 */
function isPreloadedTokenName(tokenName: string, chainId: string) {
  return Boolean(
    PRELOADED_TOKENS.find(
      (token) =>
        token.name.trim() === tokenName.trim() &&
        Number(token.chainId) === Number(chainId),
    ),
  );
}

/**
 *
 * @param tokenSymbol
 * @param chainId
 */
function isPreloadedTokenSymbol(tokenSymbol: string, chainId: string) {
  return Boolean(
    PRELOADED_TOKENS.find(
      (token) =>
        token.symbol.trim() === tokenSymbol.trim() &&
        Number(token.chainId) === Number(chainId),
    ),
  );
}

/**
 *
 * @param tokenAddress
 * @param chainId
 */
function isPreloadedTokenAddress(tokenAddress: string, chainId: string) {
  const bigIntTokenAddress = num.toBigInt(tokenAddress);
  return Boolean(
    PRELOADED_TOKENS.find(
      (token) =>
        num.toBigInt(token.address) === bigIntTokenAddress &&
        Number(token.chainId) === Number(chainId),
    ),
  );
}

/**
 *
 * @param networkChainId
 */
function isPreloadedNetworkChainId(networkChainId: string) {
  const bigIntNetworkChainId = num.toBigInt(networkChainId);
  return Boolean(
    PRELOADED_NETWORKS.find(
      (network) => num.toBigInt(network.chainId) === bigIntNetworkChainId,
    ),
  );
}

/**
 *
 * @param networkName
 */
function isPreloadedNetworkName(networkName: string) {
  return Boolean(
    PRELOADED_NETWORKS.find(
      (network) => network.name.trim() === networkName.trim(),
    ),
  );
}

/**
 *
 * @param params
 * @param network
 */
export function validateAddErc20TokenParams(
  params: AddErc20TokenRequestParams,
  network: Network,
) {
  try {
    validateAndParseAddress(params.tokenAddress);
  } catch (err) {
    throw new Error(
      `The given token address is invalid: ${params.tokenAddress}`,
    );
  }

  if (!isValidTokenName(params.tokenName)) {
    throw new Error(
      `The given token name is invalid, needs to be in ASCII chars, not all spaces, and has length larger than ${MAXIMUM_TOKEN_NAME_LENGTH}: ${params.tokenName}`,
    );
  }

  if (!isValidTokenSymbol(params.tokenSymbol)) {
    throw new Error(
      `The given token symbol is invalid, needs to be in ASCII chars, not all spaces, and has length larger than ${MAXIMUM_TOKEN_SYMBOL_LENGTH}: ${params.tokenSymbol}`,
    );
  }

  if (
    isPreloadedTokenAddress(params.tokenAddress, network.chainId) ||
    isPreloadedTokenName(params.tokenName, network.chainId) ||
    isPreloadedTokenSymbol(params.tokenSymbol, network.chainId)
  ) {
    throw new Error(
      'The given token address, name, or symbol is the same as one of the preloaded tokens, and thus cannot be added',
    );
  }
}

/**
 *
 * @param params
 */
export function validateAddNetworkParams(params: AddNetworkRequestParams) {
  if (!isValidNetworkName(params.networkName)) {
    throw new Error(
      `The given network name is invalid, needs to be in ASCII chars, not all spaces, and has length larger than ${MAXIMUM_NETWORK_NAME_LENGTH}: ${params.networkName}`,
    );
  }

  if (!isHexWithPrefix(params.networkChainId)) {
    throw new Error(
      `The given network chainId is not in hexadecimal string with prefix: ${params.networkChainId}`,
    );
  }

  if (params.networkBaseUrl && !isValidHttpUrl(params.networkBaseUrl)) {
    throw new Error(
      `The given network REST API base URL is not an valid HTTP/HTTPS URL: ${params.networkBaseUrl}`,
    );
  }

  if (params.networkNodeUrl && !isValidHttpUrl(params.networkNodeUrl)) {
    throw new Error(
      `The given network RPC node URL is not an valid HTTP/HTTPS URL: ${params.networkNodeUrl}`,
    );
  }

  if (params.networkVoyagerUrl && !isValidHttpUrl(params.networkVoyagerUrl)) {
    throw new Error(
      `The given network Voyager URL is not an valid HTTP/HTTPS URL: ${params.networkVoyagerUrl}`,
    );
  }

  if (params.accountClassHash) {
    try {
      validateAndParseAddress(params.accountClassHash);
    } catch (err) {
      throw new Error(
        `The given account class hash is invalid: ${params.accountClassHash}`,
      );
    }
  }

  if (
    isPreloadedNetworkChainId(params.networkChainId) ||
    isPreloadedNetworkName(params.networkName)
  ) {
    throw new Error(
      'The given network chainId or name is the same as one of the preloaded networks, and thus cannot be added',
    );
  }
}

export const getValidNumber = (
  obj,
  defaultValue: number,
  minVal: number = Number.MIN_SAFE_INTEGER,
  maxVal: number = Number.MAX_SAFE_INTEGER,
) => {
  const toNum = Number(obj);
  return obj === '' || isNaN(toNum) || toNum > maxVal || toNum < minVal
    ? defaultValue
    : toNum;
};

/**
 *
 * @param state
 * @param contractAddress
 * @param contractFuncName
 * @param contractCallData
 * @param senderAddress
 * @param maxFee
 * @param network
 */
export function getSigningTxnText(
  state: SnapState,
  contractAddress: string,
  contractFuncName: string,
  contractCallData: string[],
  senderAddress: string,
  maxFee: num.BigNumberish,
  network: Network,
): Component[] {
  // Retrieve the ERC-20 token from snap state for confirmation display purpose
  const token = getErc20Token(state, contractAddress, network.chainId);
  const tokenTransferComponents1 = [];
  const tokenTransferComponents2 = [];
  if (token && contractFuncName === 'transfer') {
    try {
      let amount = '';
      if ([3, 6, 9, 12, 15, 18].includes(token.decimals)) {
        amount = convert(contractCallData[1], -1 * token.decimals, 'ether');
      } else {
        amount = (
          Number(contractCallData[1]) * Math.pow(10, -1 * token.decimals)
        ).toFixed(token.decimals);
      }
      tokenTransferComponents2.push(text('**Sender Address:**'));
      tokenTransferComponents2.push(copyable(senderAddress));
      tokenTransferComponents2.push(text('**Recipient Address:**'));
      tokenTransferComponents2.push(copyable(contractCallData[0]));
      tokenTransferComponents2.push(text(`**Amount(${token.symbol}):**`));
      tokenTransferComponents2.push(copyable(amount));
    } catch (err) {
      logger.error(
        `getSigningTxnText: error found in amount conversion: ${err}`,
      );
    }
  }
  tokenTransferComponents1.push(text('**Signer Address:**'));
  tokenTransferComponents1.push(copyable(senderAddress));
  tokenTransferComponents1.push(text('**Contract:**'));
  tokenTransferComponents1.push(copyable(contractAddress));
  tokenTransferComponents1.push(text('**Call Data:**'));
  tokenTransferComponents1.push(copyable(`[${contractCallData.join(', ')}]`));
  tokenTransferComponents1.push(text('**Estimated Gas Fee(ETH):**'));
  tokenTransferComponents1.push(copyable(convert(maxFee, 'wei', 'ether')));
  tokenTransferComponents1.push(text('**Network:**'));
  tokenTransferComponents1.push(copyable(network.name));

  return tokenTransferComponents1.concat(tokenTransferComponents2);
}

/**
 *
 * @param tokenAddress
 * @param tokenName
 * @param tokenSymbol
 * @param tokenDecimals
 * @param network
 */
export function getAddTokenText(
  tokenAddress: string,
  tokenName: string,
  tokenSymbol: string,
  tokenDecimals: number,
  network: Network,
) {
  return `Token Address: ${tokenAddress}\n\nToken Name: ${tokenName}\n\nToken Symbol: ${tokenSymbol}\n\nToken Decimals: ${tokenDecimals}\n\nNetwork: ${network.name}`;
}

/**
 *
 * @param state
 * @param accountAddress
 * @param chainId
 */
export function getAccount(
  state: SnapState,
  accountAddress: string,
  chainId: string,
) {
  const bigIntAccountAddress = num.toBigInt(accountAddress);
  return state.accContracts?.find(
    (acc) =>
      num.toBigInt(acc.address) === bigIntAccountAddress &&
      Number(acc.chainId) === Number(chainId),
  );
}

/**
 *
 * @param state
 * @param chainId
 */
export function getAccounts(state: SnapState, chainId: string) {
  return state.accContracts
    .filter((acc) => Number(acc.chainId) === Number(chainId))
    .sort((a: AccContract, b: AccContract) => a.addressIndex - b.addressIndex);
}

/**
 *
 * @param userAccount
 * @param wallet
 * @param mutex
 * @param state
 */
export async function upsertAccount(
  userAccount: AccContract,
  wallet,
  mutex: Mutex,
  state: SnapState = undefined,
) {
  return mutex.runExclusive(async () => {
    if (!state) {
      state = await wallet.request({
        method: 'snap_manageState',
        params: {
          operation: 'get',
        },
      });
    }

    const storedAccount = getAccount(
      state,
      userAccount.address,
      userAccount.chainId,
    );
    if (!storedAccount) {
      if (!state.accContracts) {
        state.accContracts = [];
      }
      state.accContracts.push(userAccount);
    } else {
      if (toJson(storedAccount) === toJson(userAccount)) {
        logger.log(
          `upsertAccount: same account and hence skip calling snap state update: ${toJson(
            storedAccount,
          )}`,
        );
        return;
      }
      storedAccount.addressSalt = userAccount.addressSalt;
      storedAccount.addressIndex = userAccount.addressIndex;
      storedAccount.derivationPath = userAccount.derivationPath;
      storedAccount.publicKey = userAccount.publicKey;
      storedAccount.deployTxnHash =
        userAccount.deployTxnHash || storedAccount.deployTxnHash;
    }

    await wallet.request({
      method: 'snap_manageState',
      params: {
        operation: 'update',
        newState: state,
      },
    });
  });
}

/**
 *
 * @param state
 * @param chainId
 */
export function getNetwork(state: SnapState, chainId: string) {
  return state.networks?.find(
    (network) =>
      Number(network.chainId) === Number(chainId) && !network?.useOldAccounts,
  );
}

/**
 *
 * @param state
 */
export function getNetworks(state: SnapState) {
  return state.networks;
}

/**
 *
 * @param network
 * @param wallet
 * @param mutex
 * @param state
 */
export async function upsertNetwork(
  network: Network,
  wallet,
  mutex: Mutex,
  state: SnapState = undefined,
) {
  return mutex.runExclusive(async () => {
    if (!state) {
      state = await wallet.request({
        method: 'snap_manageState',
        params: {
          operation: 'get',
        },
      });
    }

    const storedNetwork = getNetwork(state, network.chainId);
    if (!storedNetwork) {
      if (!state.networks) {
        state.networks = [];
      }
      state.networks.push(network);
    } else {
      if (toJson(storedNetwork) === toJson(network)) {
        logger.log(
          `upsertNetwork: same network and hence skip calling snap state update: ${toJson(
            storedNetwork,
          )}`,
        );
        return;
      }
      storedNetwork.name = network.name;
      storedNetwork.baseUrl = network.baseUrl;
      storedNetwork.nodeUrl = network.nodeUrl;
      storedNetwork.voyagerUrl = network.voyagerUrl;
      storedNetwork.accountClassHash = network.accountClassHash;
    }

    await wallet.request({
      method: 'snap_manageState',
      params: {
        operation: 'update',
        newState: state,
      },
    });
  });
}

/**
 *
 * @param state
 * @param tokenAddress
 * @param chainId
 */
export function getErc20Token(
  state: SnapState,
  tokenAddress: string,
  chainId: string,
) {
  const bigIntTokenAddress = num.toBigInt(tokenAddress);
  return state.erc20Tokens?.find(
    (token) =>
      num.toBigInt(token.address) === bigIntTokenAddress &&
      Number(token.chainId) === Number(chainId),
  );
}

/**
 *
 * @param state
 * @param chainId
 */
export function getErc20Tokens(state: SnapState, chainId: string) {
  return state.erc20Tokens?.filter(
    (token) => Number(token.chainId) === Number(chainId),
  );
}

/**
 *
 * @param state
 * @param chainId
 */
export function getEtherErc20Token(state: SnapState, chainId: string) {
  return state.erc20Tokens?.find(
    (token) =>
      Number(token.chainId) === Number(chainId) && token.symbol === 'ETH',
  );
}

/**
 *
 * @param erc20Token
 * @param wallet
 * @param mutex
 * @param state
 */
export async function upsertErc20Token(
  erc20Token: Erc20Token,
  wallet,
  mutex: Mutex,
  state: SnapState = undefined,
) {
  return mutex.runExclusive(async () => {
    if (!state) {
      state = await wallet.request({
        method: 'snap_manageState',
        params: {
          operation: 'get',
        },
      });
    }

    const storedErc20Token = getErc20Token(
      state,
      erc20Token.address,
      erc20Token.chainId,
    );
    if (!storedErc20Token) {
      if (!state.erc20Tokens) {
        state.erc20Tokens = [];
      }
      state.erc20Tokens.push(erc20Token);
    } else {
      if (toJson(storedErc20Token) === toJson(erc20Token)) {
        logger.log(
          `upsertErc20Token: same Erc20 token and hence skip calling snap state update: ${toJson(
            storedErc20Token,
          )}`,
        );
        return;
      }
      storedErc20Token.name = erc20Token.name;
      storedErc20Token.symbol = erc20Token.symbol;
      storedErc20Token.decimals = erc20Token.decimals;
    }

    await wallet.request({
      method: 'snap_manageState',
      params: {
        operation: 'update',
        newState: state,
      },
    });
  });
}

/**
 *
 * @param state
 * @param targerChainId
 */
export function getNetworkFromChainId(
  state: SnapState,
  targerChainId: string | undefined,
) {
  const chainId = targerChainId || STARKNET_TESTNET_NETWORK.chainId;
  const network = getNetwork(state, chainId);
  if (!network) {
    throw new Error(
      `can't find the network in snap state with chainId: ${chainId}`,
    );
  }

  logger.log(
    `getNetworkFromChainId: From ${targerChainId}:\n${toJson(network)}`,
  );
  return network;
}

/**
 *
 * @param network
 */
export function getChainIdHex(network: Network) {
  return `0x${Number(network.chainId).toString(16)}`;
}

/**
 *
 * @param network
 */
export function getTransactionFromVoyagerUrl(network: Network) {
  return `${network.voyagerUrl}${VOYAGER_API_TXN_URL_SUFFIX}`;
}

/**
 *
 * @param network
 */
export function getTransactionsFromVoyagerUrl(network: Network) {
  return `${network.voyagerUrl}${VOYAGER_API_TXNS_URL_SUFFIX}`;
}

/**
 *
 * @param state
 * @param txnHash
 * @param chainId
 */
export function getTransaction(
  state: SnapState,
  txnHash: string,
  chainId: string,
) {
  const bigIntTxnHash = num.toBigInt(txnHash);
  return state.transactions?.find(
    (txn) =>
      num.toBigInt(txn.txnHash) === bigIntTxnHash &&
      Number(txn.chainId) === Number(chainId),
  );
}

/**
 *
 * @param state
 * @param chainId
 * @param senderAddress
 * @param contractAddress
 * @param txnType
 * @param finalityStatus
 * @param executionStatus
 * @param minTimestamp
 */
export function getTransactions(
  state: SnapState,
  chainId: string,
  senderAddress: string | undefined,
  contractAddress: string | undefined,
  txnType: VoyagerTransactionType | string | string[] | undefined,
  finalityStatus: string | string[] | undefined,
  executionStatus: string | string[] | undefined,
  minTimestamp: number | undefined, // in ms
): Transaction[] {
  let filteredTxns: Transaction[] = [];
  if (state.transactions) {
    filteredTxns = filterTransactions(state.transactions, [
      new ChainIdFilter(Number(chainId)),
      new TimestampFilter(minTimestamp),
      new SenderAddressFilter(
        senderAddress ? num.toBigInt(senderAddress) : undefined,
      ),
      new ContractAddressFilter(
        contractAddress ? num.toBigInt(contractAddress) : undefined,
      ),
      new TxnTypeFilter(txnType),
      new StatusFilter(finalityStatus, executionStatus),
    ]);
  }
  return filteredTxns;
}

/**
 *
 * @param txn
 * @param wallet
 * @param mutex
 * @param state
 */
export async function upsertTransaction(
  txn: Transaction,
  wallet,
  mutex: Mutex,
  state: SnapState = undefined,
) {
  return mutex.runExclusive(async () => {
    if (!state) {
      state = await wallet.request({
        method: 'snap_manageState',
        params: {
          operation: 'get',
        },
      });
    }

    const storedTxn = getTransaction(state, txn.txnHash, txn.chainId);
    if (!storedTxn) {
      if (!state.transactions) {
        state.transactions = [];
      }
      state.transactions.push(txn);
    } else {
      if (toJson(storedTxn) === toJson(txn)) {
        logger.log(
          `upsertTransaction: same transaction and hence skip calling snap state update: ${toJson(
            storedTxn,
          )}`,
        );
        return;
      }
      storedTxn.status = txn.status;
      storedTxn.executionStatus = txn.executionStatus;
      storedTxn.finalityStatus = txn.finalityStatus;
      storedTxn.failureReason = txn.failureReason;
      storedTxn.timestamp = txn.timestamp;
    }

    await wallet.request({
      method: 'snap_manageState',
      params: {
        operation: 'update',
        newState: state,
      },
    });
  });
}

/**
 *
 * @param txns
 * @param wallet
 * @param mutex
 * @param state
 */
export async function upsertTransactions(
  txns: Transaction[],
  wallet,
  mutex: Mutex,
  state: SnapState = undefined,
) {
  return mutex.runExclusive(async () => {
    if (!state) {
      state = await wallet.request({
        method: 'snap_manageState',
        params: {
          operation: 'get',
        },
      });
    }

    txns.forEach((txn) => {
      const storedTxn = getTransaction(state, txn.txnHash, txn.chainId);
      if (!storedTxn) {
        if (!state.transactions) {
          state.transactions = [];
        }
        state.transactions.push(txn);
      } else {
        storedTxn.status = txn.status;
        storedTxn.executionStatus = txn.executionStatus;
        storedTxn.finalityStatus = txn.finalityStatus;
        storedTxn.failureReason = txn.failureReason;
        storedTxn.timestamp = txn.timestamp;
      }
    });

    await wallet.request({
      method: 'snap_manageState',
      params: {
        operation: 'update',
        newState: state,
      },
    });
  });
}

/**
 *
 * @param minTimeStamp
 * @param wallet
 * @param mutex
 * @param state
 */
export async function removeAcceptedTransaction(
  minTimeStamp: number,
  wallet,
  mutex: Mutex,
  state: SnapState = undefined,
) {
  return mutex.runExclusive(async () => {
    if (!state) {
      state = await wallet.request({
        method: 'snap_manageState',
        params: {
          operation: 'get',
        },
      });
    }

    state.transactions = state.transactions.filter(
      (txn) =>
        (txn.finalityStatus !== TransactionStatus.ACCEPTED_ON_L2 &&
          txn.finalityStatus !== TransactionStatus.ACCEPTED_ON_L1) ||
        (txn.finalityStatus === TransactionStatus.ACCEPTED_ON_L2 &&
          txn.timestamp * 1000 >= minTimeStamp),
    );

    await wallet.request({
      method: 'snap_manageState',
      params: {
        operation: 'update',
        newState: state,
      },
    });
  });
}

/**
 *
 * @param arr
 * @param key
 * @param keyConverter
 */
export function toMap<k, v, z>(
  arr: v[],
  key: string,
  keyConverter?: (v: z) => k,
): Map<k, v> {
  return arr.reduce((map, obj: v) => {
    map.set(
      keyConverter && typeof keyConverter === 'function'
        ? keyConverter(obj[key] as z)
        : obj[key],
      obj,
    );
    return map;
  }, new Map<k, v>());
}
