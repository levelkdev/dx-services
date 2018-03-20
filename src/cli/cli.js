#!/usr/bin/env node
const loggerNamespace = 'cli'
const Logger = require('../helpers/Logger')
const logger = new Logger(loggerNamespace)
require('../helpers/gracefullShutdown')

const yargs = require('yargs')
const testSetup = require('../../tests/helpers/testSetup')

testSetup()
  .then(run)
  .catch(console.error)

async function run (instances) {
  const cli = yargs.usage('$0 <cmd> [args]')
  const commandParams = { cli, instances, logger }

  // Info commands
  require('./commands/printStateCmd')(commandParams)

  // Trade commands
  // buy, sell, ..

  // Liquidity commands
  require('./commands/sellLiquidityCmd')(commandParams)
  require('./commands/buyLiquidityCmd')(commandParams)

  // Setup commands (we might need to move this ones to `setup` cli)
  // add-token-pair, add-funding-for-test-user,...
  const width = Math.min(100, yargs.terminalWidth())
  const argv = cli
    .wrap(width)
    .help('h')
    .strict()
    .argv

  if (!argv._[0]) {
    cli.showHelp()
  }
}