const cliUtils = require('../helpers/cliUtils')

function registerCommand ({ cli, instances, logger }) {
  cli.command(
    'deposit <amount> <token> [--acount account]',
    'Deposit the DX account depositing tokens into it',
    yargs => {
      cliUtils.addPositionalByName('amount', yargs)
      cliUtils.addPositionalByName('token', yargs)
      cliUtils.addPositionalByName('account', yargs)
    }, async function (argv) {
      const { account, amount, token } = argv
      const {
        botAccount,
        dxTradeService
      } = instances

      const accountAddress = account || botAccount

      logger.info(`Deposit %d %s into the DX for %s`,
        amount,
        token,
        accountAddress
      )
      const depositResult = await dxTradeService.deposit({
        token,
        amount: amount * 1e18,
        accountAddress
      })
      logger.info('The delivery was succesful. Transaction: %s', depositResult.tx)
    })
}

module.exports = registerCommand
