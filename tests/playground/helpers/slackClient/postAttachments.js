const slackClient = require('../../../../src/helpers/slackClient')

const message = {
   "channel": 'GA5J9F13J',
  "text": "The bot account has a balance below the threshold",
  "attachments": [
    {
      "title": "Review the bot balance",
      "fallback": "The bot account has tokens below the $5000 worth of value",
      "color": "danger",
      "author_name": "BalanceCheckBot",
      "text": "The bot account has tokens below the $5000 worth of value:",
      "fields": [
        {
          "title": "WETH",
          "value": "2.13 WETH ($1.252)",
          "short": false
        }, {
          "title": "RDN",
          "value": "1658 RDN ($2.719,12)",
          "short": false
        }
      ],
      "footer": "Dutch X Bots - v1.0",
      "ts": 123456789
    }, {
      "color": "danger",
      "title": "The bot account is running out of Ether",
      "text": "0.1345 ETH"
    }, {
      "color": "good",
      "title": "This tokens should be OK",
      "text": "The tokens above the threshold are:",
      "fields": [
        {
          "title": "OMG",
          "value": "575 OMG ($7.538,25)",
          "short": false
        }
      ]
    }
  ]
}

slackClient.postMessage(message)
  .then(res => {
    // `res` contains information about the posted message
    console.log('Message sent: ', res.ts)
  })
  .catch(console.error)