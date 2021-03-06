const debug = require('debug')('DEBUG-dx-service:tests:helpers:watchEthereumEvents')
const testSetup = require('../../helpers/testSetup')
const ethereumEventHelper = require('../../../src/helpers/ethereumEventHelper')

testSetup()
  .then(run)
  .catch(console.error)

function run ({
  dx
}) {
  const filter = ethereumEventHelper.watch({
    name: 'DX',
    contract: dx,
    fromBlock: 0, // 'latest'
    toBlock: 'latest',
    callback (error, event) {
      if (error) {
        console.error(error)
      } else {
        debug('Got event %s - %o', event.name, event)
      }
    },
    events: [
      'NewDeposit',
      'NewWithdrawal',
      'NewSellOrder',
      'NewBuyOrder',
      'NewSellerFundsClaim',
      'NewBuyerFundsClaim',
      'NewTokenPair',
      'AuctionCleared',
      'Log',
      'LogOustandingVolume',
      'LogNumber',
      'ClaimBuyerFunds'
    ]
  })

  setTimeout(() => {
    filter.stopWatching()
  }, 10000)
}
