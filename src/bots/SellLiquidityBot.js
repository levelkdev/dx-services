const loggerNamespace = 'dx-service:bots:SellLiquidityBot'
const AuctionLogger = require('../helpers/AuctionLogger')
const Bot = require('./Bot')
const Logger = require('../helpers/Logger')

const logger = new Logger(loggerNamespace)
const auctionLogger = new AuctionLogger(loggerNamespace)
const events = require('../helpers/events')
const ENSURE_LIQUIDITY_PERIODIC_CHECK_MILLISECONDS = 60 * 1000

class SellLiquidityBot extends Bot {
  constructor ({ name, eventBus, liquidityService, botAddress, markets }) {
    super(name)
    this._eventBus = eventBus
    this._liquidityService = liquidityService
    this._botAddress = botAddress
    this._markets = markets

    this._lastCheck = null
    this._lastSell = null
    this._lastError = null
  }

  async _doStart () {
    logger.debug({ msg: 'Initialized bot' })

    // Ensure the sell liquidity when an aunction has ended
    this._eventBus.listenTo(events.EVENT_AUCTION_CLEARED, ({ eventName, data }) => {
      this._onAuctionCleared(eventName, data)
    })

    // Backup strategy: From time to time, we ensure the liquidity
    // Used only in case events fail to notify the bot
    setInterval(() => {
      this._markets.forEach(market => {
        const sellToken = market.tokenA
        const buyToken = market.tokenB
        this._doRoutineLiquidityCheck(sellToken, buyToken)
      })
    }, ENSURE_LIQUIDITY_PERIODIC_CHECK_MILLISECONDS)
  }

  async _doStop () {
    logger.debug({ msg: 'Bot stopped' })
  }

  async _onAuctionCleared (eventName, data) {
    const { sellToken, buyToken } = data

    // Do ensure liquidity on the market
    auctionLogger.info({
      sellToken,
      buyToken,
      msg: "Auction ended. Let's ensure sell liquidity"
    })
    return this._ensureSellLiquidity({
      sellToken,
      buyToken,
      from: this._botAddress
    })
  }

  async _ensureSellLiquidity ({ sellToken, buyToken, from, isRoutineCheck = false }) {
    this._lastCheck = new Date()
    let liquidityWasEnsured
    try {
      liquidityWasEnsured = await this._liquidityService
        .ensureSellLiquidity({ sellToken, buyToken, from })
        .then(soldTokens => {
          // soldTokens is:
          //  * NULL when nothing was sold
          //  * An object with {amount, sellToken, buyToken} when the liquidityService
          //    had to sell tokens
          if (soldTokens) {
            this._lastSell = new Date()
            // The bot sold some tokens
            auctionLogger.info({
              sellToken,
              buyToken,
              msg: "I've sold %d %s (%d USD) to ensure sell liquidity",
              params: [
                soldTokens.amount.div(1e18),
                soldTokens.sellToken,
                soldTokens.amountInUSD
              ],
              notify: true
            })

            if (isRoutineCheck) {
              auctionLogger.warn({
                sellToken,
                buyToken,
                msg: "The sell liquidity was enssured by the routine check. Make sure there's no problem getting events"
              })
            }
          } else {
            // The bot didn't have to do anything
            auctionLogger.debug({
              sellToken,
              buyToken,
              msg: 'Nothing to do'
            })
          }

          return true
        })
    } catch (error) {
      this._lastError = new Date()
      liquidityWasEnsured = false
      this._handleError(sellToken, buyToken, error)
    }

    return liquidityWasEnsured
  }

  async _doRoutineLiquidityCheck (sellToken, buyToken) {
    // Do ensure liquidity on the market
    auctionLogger.debug({
      sellToken,
      buyToken,
      msg: "Doing a routine check. Let's see if we need to ensure the sell liquidity"
    })
    return this._ensureSellLiquidity({
      sellToken,
      buyToken,
      from: this._botAddress,
      isRoutineCheck: true
    })
  }

  _handleError (sellToken, buyToken, error) {
    auctionLogger.error({
      sellToken,
      buyToken,
      msg: 'There was an error ensuring sell liquidity with the account %s: %s',
      params: [ this._botAddress, error ],
      error
    })
  }

  async getInfo () {
    return {
      botAddress: this._botAddress,
      lastCheck: this._lastCheck,
      lastSell: this._lastSell,
      lastError: this._lastError
    }
  }
}

module.exports = SellLiquidityBot
