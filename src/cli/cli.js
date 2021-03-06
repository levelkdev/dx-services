#!/usr/bin/env node
const { MNEMONIC: DEFAULT_MNEMONIC } = require('../../conf/env/local-config')
const mnemonic = process.env.MNEMONIC || DEFAULT_MNEMONIC
process.env.MNEMONIC = mnemonic

const loggerNamespace = 'cli'
const Logger = require('../helpers/Logger')
const logger = new Logger(loggerNamespace)
require('../helpers/gracefullShutdown')

// TODO: Use instance factory instead
// TODO: If MARKETS is undefined or NULL --> load all
const yargs = require('yargs')
const testSetup = require('../../tests/helpers/testSetup')

testSetup()
  .then(run)
  .catch(console.error)

async function run (instances) {
  const cli = yargs.usage('$0 <cmd> [args]')
  const commandParams = { cli, instances, logger }

  // Info commands
  require('./cliCommands/balancesCmd')(commandParams)
  require('./cliCommands/marketsCmd')(commandParams)
  require('./cliCommands/tokensCmd')(commandParams)
  require('./cliCommands/stateCmd')(commandParams)
  require('./cliCommands/priceCmd')(commandParams)
  require('./cliCommands/usdPriceComand')(commandParams)
  require('./cliCommands/marketPriceCmd')(commandParams)
  require('./cliCommands/closingPricesCmd')(commandParams)
  require('./cliCommands/getSellerBalanceCmd')(commandParams)
  require('./cliCommands/auctionBalancesTokensCmd')(commandParams)
  require('./cliCommands/indexCmd')(commandParams)
  require('./cliCommands/approvedCmd')(commandParams)
  require('./cliCommands/closingPriceCmd')(commandParams)
  require('./cliCommands/closingPriceOfficialCmd')(commandParams)

  // Trade commands
  require('./cliCommands/sendCmd')(commandParams)
  require('./cliCommands/depositCmd')(commandParams)
  require('./cliCommands/withdrawCmd')(commandParams)
  require('./cliCommands/buyCmd')(commandParams)
  require('./cliCommands/sellCmd')(commandParams)
  require('./cliCommands/tradesCmd')(commandParams)
  require('./cliCommands/auctionsCmd')(commandParams)
  require('./cliCommands/unwrapEtherCmd')(commandParams)
  require('./cliCommands/claimableTokensCmd')(commandParams)
  require('./cliCommands/claimTokensCmd')(commandParams)
  require('./cliCommands/claimSellerFundsCmd')(commandParams)
  require('./cliCommands/claimBuyerFundsCmd')(commandParams)

  // Liquidity commands
  require('./cliCommands/sellLiquidityCmd')(commandParams)
  require('./cliCommands/buyLiquidityCmd')(commandParams)

  // Dx Management commands
  require('./cliCommands/addTokenPairCmd')(commandParams)

  // Setup commands (we might need to move this ones to `setup` cli)
  // add-token-pair, add-funding-for-test-user,...
  const width = Math.min(100, yargs.terminalWidth())
  const argv = cli
    .wrap(width)
    .help('h')
    .strict()
    // .showHelpOnFail(false, 'Specify --help for available options')
    .argv

  if (!argv._[0]) {
    cli.showHelp()
  }
}
