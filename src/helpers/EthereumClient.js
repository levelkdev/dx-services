const loggerNamespace = 'dx-service:repositories:EthereumClient'
const Logger = require('../helpers/Logger')
const numberUtil = require('../helpers/numberUtil')
const dateUtil = require('../helpers/dateUtil')
const formatUtil = require('../helpers/formatUtil')
const logger = new Logger(loggerNamespace)
const Cache = require('../helpers/Cache')

const Web3 = require('web3')
const truffleContract = require('truffle-contract')
const HDWalletProvider = require('truffle-hdwallet-provider')
const got = require('got')

const ROOT_DIR = '../../'
const SECONDS_PER_BLOCK = 15
const CLOSE_POINT_PERCENTAGE = 0.9
const FAR_POINT_PERCENTAGE = 1 - CLOSE_POINT_PERCENTAGE

const DAFAULT_GAS_PRICE_SAFE_LOW = 6
const DAFAULT_GAS_PRICE_AVERAGE = 10
const DAFAULT_GAS_PRICE_FAST = 20

const environment = process.env.NODE_ENV

// TODO: Check eventWatcher in DX/test/utils.js

class EthereumClient {
  constructor (config) {
    this._network = config.NETWORK || null
    this._url = config.ETHEREUM_RPC_URL || 'http://127.0.0.1:8545'
    logger.debug('Using %s RPC api to connect to Ethereum', this._url)
    const mnemonic = config.MNEMONIC
    if (mnemonic) {
      this._provider = new HDWalletProvider(mnemonic, this._url, 0, 5)
      this._provider.engine.on('error', error => {
        logger.error({
          msg: 'Error in Web3 engine %s: %s',
          params: [ this._url, error.toString() ],
          error
        })
      })
    } else {
      // this._provider = new Web3.providers.HttpProvider(this._url)
      throw new Error('The MNEMONIC is required')
    }

    this._web3 = new Web3(this._provider)
    this._contractCache = {}

    this._cache = new Cache('EthereumClient')
    this._cacheEnabled = config.CACHE_ENABLED
    this._cacheTimeouts = {
      short: config.CACHE_TIME_SHORT,
      medium: config.CACHE_TIME_MEDIUM,
      large: config.CACHE_TIME_LONG
    }

    this._urlPriceFeedGasStation = config.URL_GAS_PRICE_FEED_GAS_STATION
    this._urlPriceFeedSafe = config.URL_GAS_PRICE_FEED_SAFE
  }

  getUrl () {
    return this._url
  }

  async getGasPricesGWei () {
    let pricesPromise
    if (this._urlPriceFeedSafe) {
      pricesPromise = this._doGetPricesFromSafe()
    } else if (this._urlPriceFeedGasStation) {
      pricesPromise = this._doGetPricesFromGasStation()
    } else {
      pricesPromise = this._doGetPricesFromWeb3()
    }

    return pricesPromise
    // In case of an error, we get it
    // .catch(error => {
    //   // Notify error
    //   logger.error({
    //     msg: 'Error getting the price from the feed. Retrying with web3',
    //     params: [ this._urlPriceFeedGasStation ],
    //     error
    //   })
    //   return this._doGetPricesFromWeb3()
    // })
    // In case of error, return the default (and notify error)
    // .catch(error => _handleGetGasPriceError(error))
  }

  async _doGetPricesFromSafe () {
    const gasPriceResponse = await got(this._urlPriceFeedSafe, {
      json: true
    })
    // console.log('gasPrice', gasPriceResponse.body)

    // De prices are not provided in GWei
    //  * for some reason, they are 10 times bigger than GWei :)
    //  * So 20 y 2GWei
    const gasPrices = gasPriceResponse.body
    return {
      safeLow: numberUtil.toBigNumber(gasPrices.safe_low).div(1e9),
      average: numberUtil.toBigNumber(gasPrices.standard).div(1e9),
      fast: numberUtil.toBigNumber(gasPrices.fast).div(1e9)
    }
  }

  async _doGetPricesFromGasStation () {
    const gasPriceResponse = await got(this._urlPriceFeedGasStation, {
      json: true
    })
    // console.log('gasPrice', gasPriceResponse.body)

    // De prices are not provided in GWei
    //  * for some reason, they are 10 times bigger than GWei :)
    //  * So 20 y 2GWei

    const gasPrices = gasPriceResponse.body
    return {
      safeLow: numberUtil.toBigNumber(gasPrices.safeLow).div(10),
      average: numberUtil.toBigNumber(gasPrices.average).div(10),
      fast: numberUtil.toBigNumber(gasPrices.fast).div(10)
      // safeLowWait: gasPrices.safeLowWait,
      // averageWait: gasPrices.avgWait,
      // fastWait: gasPrices.fastWait
    }
  }

  async _doGetPricesFromWeb3 () {
    const gasPrice = await _promisify(this._web3.eth.getGasPrice)

    return {
      safeLow: gasPrice.div(1e9).mul(0.9).ceil(),
      average: gasPrice.div(1e9).ceil(),
      fast: gasPrice.div(1e9).mul(2).ceil()
    }
  }

  async getBlock (blockNumber) {
    if (blockNumber === undefined) {
      blockNumber = await this.getBlockNumber()
    }
    // NOTE: not using doCall on purpose because error with this context in web3
    // Using web3 0.2.X
    const fetchFn = () =>
      _promisify(this._web3.eth.getBlock, [ blockNumber.toString() ])

    const cacheKey = this._getCacheKey({ propName: 'eth.getBlock', params: [ blockNumber.toString() ] })
    const CACHE_TIMEOUT_SHORT = this._cacheTimeouts.short
    const CACHE_TIMEOUT_MEDIUM = this._cacheTimeouts.medium
    const CACHE_TIMEOUT_LONG = this._cacheTimeouts.long

    if (this._cacheEnabled) {
      return this._cache.get({
        key: cacheKey,
        fetchFn,
        time (block) {
          const now = Date.now()
          const monthAgo = dateUtil.addPeriod(now, -1, 'month')
          const weekAgo = dateUtil.addPeriod(now, -1, 'week')
          if (block && block !== 'latest') {
            // NOTE: blockChain timestamp is returned in seconds in web3 0.2.X
            const blockDate = new Date(block.timestamp * 1000)

            // Return different cache time depending on how old is the block
            if (blockDate < monthAgo) {
              // Cache long period
              return CACHE_TIMEOUT_LONG
            } else if (blockDate < weekAgo) {
              // Cache Medium period
              return CACHE_TIMEOUT_MEDIUM
            } else {
              // Cache Short period
              return CACHE_TIMEOUT_SHORT
            }
          } else {
            // If the block return null or we ask for the latest block
            // we cache a short period
            return CACHE_TIMEOUT_SHORT
          }
        }
      })
    } else {
      return fetchFn()
    }
  }

  async getAccounts () {
    return this.doCall({ propName: 'eth.getAccounts' })
  }

  async getBlockNumber () {
    return this.doCall({ propName: 'eth.getBlockNumber' })
  }

  async geLastBlockTime () {
    // const blockNumber = this.getBlockNumber()
    // return this._promisify(this._web3.eth.getBlock, blockNumber)

    return this.getBlock()
      .then(block => new Date(block.timestamp * 1000))
  }

  async balanceOf (account) {
    return this.doCall({ propName: 'eth.getBalance', params: [ account ] })
  }

  async doCall ({ propName, params, cacheTime = this._cacheTimeouts.short }) {
    const propPath = propName.split('.')
    const callClass = this._getCallFn(this._web3, propPath)
    const methodName = propPath[propPath.length - 1]

    if (this._cacheEnabled && cacheTime !== null) {
      const cacheKey = this._getCacheKey({ propName, params })
      return this._cache.get({
        key: cacheKey,
        time: cacheTime, // Caching time in seconds
        fetchFn: () => {
          return _promisify(callClass[methodName], params) // TODO: Review promisify extra params
        }
      })
    } else {
      return _promisify(callClass[methodName], params) // TODO: Review promisify extra params
    }
  }

  _getCacheKey ({ propName, params }) {
    if (params) {
      return propName + ':' + params.join('-')
    } else {
      return propName
    }
  }

  _getCallFn (currentObject, [head, ...tail]) {
    const nextObject = currentObject[head]
    if (tail.length === 1) {
      return nextObject
    } else {
      return this._getCallFn(nextObject, tail)
    }

    /*
    const nextObject = currentObject[head]
    if (tail.length === 0) {
      nextObject.bind(currentObject)
      return nextObject
    } else {
      return this._getCallFn(nextObject, tail)
    }
    */
  }

  async getSyncing () {
    return _promisify(this._web3.eth.getSyncing)
  }

  async mineBlock (id = new Date().getTime()) {
    return this._sendAsync('evm_mine', { id })
  }

  // Returns an snapshotId
  async makeSnapshot () {
    return this._sendAsync('evm_snapshot')
      .then(snapshot => { return snapshot.result })
  }

  async revertSnapshot (snapshotId) {
    const params = snapshotId ? [snapshotId] : []
    return this._sendAsync('evm_revert', { params: params })
  }

  async getFirstBlockAfterDate (date) {
    logger.debug('Find first block after %s',
      formatUtil.formatDateTimeWithSeconds(date)
    )
    const latestBlock = await this.getBlock('latest')
    const latestBlockNumber = latestBlock.number

    return this._getFirstBlockAfterDate({
      date,
      firstBlockRange: 0,
      referenceBlock: latestBlockNumber,
      lastBlockRange: latestBlockNumber,
      lookingForBlockAfterDate: true,
      bestGuess: null
    })
  }

  async getLastBlockBeforeDate (date) {
    logger.debug('Find last block before %s',
      formatUtil.formatDateTimeWithSeconds(date)
    )
    const latestBlock = await this.getBlock('latest')
    const latestBlockNumber = latestBlock.number

    return this._getFirstBlockAfterDate({
      date,
      firstBlockRange: 0,
      referenceBlock: latestBlockNumber,
      lastBlockRange: latestBlockNumber,
      lookingForBlockAfterDate: false,
      bestGuess: null
    })
  }

  toBlocksFromSecondsEst (seconds) {
    return seconds / SECONDS_PER_BLOCK
  }

  async _getFirstBlockAfterDate ({
    date,
    firstBlockRange,
    referenceBlock,
    lastBlockRange,
    lookingForBlockAfterDate,
    bestGuess
  }) {
    logger.debug('Looking between %s and %s. lookingForBlockAfterDate=%s',
      formatUtil.formatNumber(firstBlockRange),
      formatUtil.formatNumber(lastBlockRange),
      lookingForBlockAfterDate
    )
    let nextBestGuess = bestGuess
    const block = await this.getBlock(referenceBlock)

    if (block === null) {
      throw new Error(`The reference block ${referenceBlock} was not found, posible reorg`)
    }

    const blockDate = new Date(block.timestamp * 1000)
    const seccondsDifference = dateUtil.diff(blockDate, date, 'seconds')
    const blocksDifference = this.toBlocksFromSecondsEst(seccondsDifference)

    logger.debug(' * Reference block %s has date %s. Difference:',
      formatUtil.formatNumber(referenceBlock),
      formatUtil.formatDateTimeWithSeconds(blockDate),
      formatUtil.formatDatesDifference(blockDate, date)
    )

    let nextFirstBlockRange, nextReferenceBlock, nextLastBlockRange
    if (seccondsDifference === 0) {
      // We found the block, the only one we've got
      logger.debug(' * Nice we found the block, and it was exact match: %s',
        formatUtil.formatNumber(referenceBlock)
      )
      return referenceBlock
    } else if (seccondsDifference > 0) {
      // Between the reference and the last block

      // Improve best guess, if posible
      if (!lookingForBlockAfterDate) {
        // We look for a block before the date. Since the reference is before the date
        // It's our new best guess
        logger.debug(" * There reference block is before the date, so it's our current best guess")
        nextBestGuess = referenceBlock
      }

      // Calculate the new range
      nextFirstBlockRange = referenceBlock + (lookingForBlockAfterDate ? 1 : 0)
      nextReferenceBlock = Math.min(
        Math.ceil(referenceBlock + blocksDifference),
        lastBlockRange
      )
      nextLastBlockRange = lastBlockRange

      if (nextReferenceBlock >= lastBlockRange) {
        // Time estimation can be innacurate, especially when we are closing the range
        // In case we set as the new reference a block close to the last block
        nextReferenceBlock = Math.ceil(
          nextFirstBlockRange * FAR_POINT_PERCENTAGE +
          nextLastBlockRange * CLOSE_POINT_PERCENTAGE
        )
      }
    } else {
      // Between the first and the reference

      // Improve best guess, if posible
      if (lookingForBlockAfterDate) {
        // We look for a block after the date. Since the reference is after the date
        // It's our new best guess
        logger.debug(" * There reference block is after the date, so it's our current best guess")
        nextBestGuess = referenceBlock
      }

      // Calculate the new range
      nextFirstBlockRange = firstBlockRange
      nextReferenceBlock = Math.max(
        Math.floor(referenceBlock + blocksDifference),
        firstBlockRange
      )
      nextLastBlockRange = referenceBlock + (lookingForBlockAfterDate ? 0 : -1)

      if (nextReferenceBlock <= firstBlockRange) {
        // Time estimation can be innacurate, especially when we are closing the range
        // In case we set as the new reference a block close to the first block
        nextReferenceBlock = Math.floor(
          nextFirstBlockRange * CLOSE_POINT_PERCENTAGE +
          nextLastBlockRange * FAR_POINT_PERCENTAGE
        )
      }
    }

    const numRemainingBlocks = 1 + nextLastBlockRange - nextFirstBlockRange
    if (numRemainingBlocks < 1 || referenceBlock === nextReferenceBlock) {
      // There's no blocks left to check
      if (nextBestGuess !== null) {
        logger.debug(" * There's not blocks left to check. The matching block is the %s",
          formatUtil.formatNumber(nextBestGuess)
        )
      } else {
        logger.debug(" * There's not blocks %s %s",
          lookingForBlockAfterDate ? 'after' : 'before',
          formatUtil.formatDateTimeWithSeconds(date)
        )
      }
      return nextBestGuess
    } else {
      // We must continue looking
      const jumpInBlocks = nextReferenceBlock - referenceBlock
      logger.debug(' * Moving %s %s positions the reference block',
        jumpInBlocks > 0 ? 'ahead' : 'back',
        formatUtil.formatNumber(Math.abs(jumpInBlocks))
      )
      logger.debug(' * We have to keep looking, still %s candidate blocks',
        formatUtil.formatNumber(nextLastBlockRange - nextFirstBlockRange)
      )
      return this._getFirstBlockAfterDate({
        date,
        firstBlockRange: nextFirstBlockRange,
        referenceBlock: nextReferenceBlock,
        lastBlockRange: nextLastBlockRange,
        lookingForBlockAfterDate,
        bestGuess: nextBestGuess
      })
    }
  }

  async increaseTime (increaseMs) {
    const id = Date.now()
    return this
      // Increase time
      ._sendAsync('evm_increaseTime', {
        id,
        params: [ increaseMs ]
      })
      // then mine block
      .then(() => {
        return this.mineBlock(id + 1)
      })
  }

  async _sendAsync (method, data) {
    const params = Object.assign({
      method,
      jsonrpc: '2.0'
    }, data)

    return _promisify((params, cb) => {
      // we need to curry the function
      this._web3.currentProvider.sendAsync(params, cb)
    }, [ params ])
  }

  getWeb3 () {
    return this._web3
  }

  loadContract (contractDefinitionPath) {
    const contractJson = require(ROOT_DIR + contractDefinitionPath)
    const contract = truffleContract(contractJson)
    contract.setProvider(this._provider)

    return contract
  }
}

async function _promisify (fn, params) {
  return new Promise((resolve, reject) => {
    const callback = (error, data) => {
      if (error) {
        reject(error)
      } else {
        resolve(data)
      }
    }

    if (params) {
      fn(...params, callback)
    } else {
      fn(callback)
    }
  })
}

function _handleGetGasPriceError (error) {
  // Notify error
  logger.error({
    msg: 'Error getting the price: %o',
    params: [{
      environment,
      network: this._network,
      gasStation: this._urlPriceFeedGasStation,
      safe: this._urlPriceFeedSafe
    }],
    error
  })

  // Return fallback default gas price
  return {
    safeLow: DAFAULT_GAS_PRICE_SAFE_LOW,
    average: DAFAULT_GAS_PRICE_AVERAGE,
    fast: DAFAULT_GAS_PRICE_FAST
  }
}

module.exports = EthereumClient
