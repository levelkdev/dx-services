const ENVIRONMENT = 'LOCAL'

const MINIMUM_SELL_VOLUME_USD = 1000
const MARKETS = [
  { tokenA: 'ETH', tokenB: 'RDN' },
  { tokenA: 'ETH', tokenB: 'OMG' }
]
const BUY_THRESHOLDS = [{
  marketPriceRatio: 1,
  buyRatio: 1 / 3
}, {
  marketPriceRatio: 0.98,
  buyRatio: 2 / 3
}, {
  marketPriceRatio: 0.96,
  buyRatio: 1
}]

const ETHEREUM_RPC_URL = 'http://127.0.0.1:8545'
const BOT_ACCOUNT_MNEMONIC = 'candy maple cake sugar pudding cream honey rich smooth crumble sweet treat'
// const BOT_ACCOUNT_MNEMONIC = null

const API_PORT = 8080
const API_HOST = '0.0.0.0'

const DX_CONTRACT_ADDRESS = null
const RDN_TOKEN_ADDRESS = null
const OMG_TOKEN_ADDRESS = null

// Kraken custom config
const KRAKEN = {
  url: 'https://api.kraken.com',
  version: '0'
}

const AUCTION_REPO_IMPL = 'mock' // mock, ethereum
const ETHEREUM_REPO_IMPL = 'impl' // mock. impl

module.exports = {
  ENVIRONMENT,

  // bot config
  MINIMUM_SELL_VOLUME_USD,
  BUY_THRESHOLDS,
  MARKETS,

  // Ethereum config
  ETHEREUM_RPC_URL,
  BOT_ACCOUNT_MNEMONIC,

  // REPO
  AUCTION_REPO_IMPL,
  ETHEREUM_REPO_IMPL,

  // CONTRACTS
  RDN_TOKEN_ADDRESS,
  OMG_TOKEN_ADDRESS,
  DX_CONTRACT_ADDRESS,

  // API
  API_PORT,
  API_HOST,

  // Exchanges
  KRAKEN
}
