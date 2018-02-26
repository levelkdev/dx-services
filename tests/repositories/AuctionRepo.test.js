const testSetup = require('../helpers/testSetup')
const BigNumber = require('bignumber.js')

const setupPromise = testSetup()

let currentSnapshotId

beforeEach(async () => {
  const { ethereumClient } = await setupPromise

  currentSnapshotId = await ethereumClient.makeSnapshot()
})

afterEach(async () => {
  const { ethereumClient } = await setupPromise

  return ethereumClient.revertSnapshot(currentSnapshotId)
})

test('It should allow to approve one token', async () => {
  const { auctionRepo, owner } = await setupPromise
  const getIsApprovedRDN = () => auctionRepo.isApprovedToken({
    token: 'RDN'
  })

  // GIVEN a not approved token
  let isRdnApproved = await getIsApprovedRDN()
  expect(isRdnApproved).toBeFalsy()

  // WHEN approve the token
  await auctionRepo.approveToken({
    token: 'RDN', from: owner
  })

  // THEN the token is approved
  isRdnApproved = await getIsApprovedRDN()
  expect(isRdnApproved).toBeTruthy()
})
describe('Market interacting tests', async () => {
  let beforeSetupState

  beforeAll(async () => {
    const { setupTestCases, ethereumClient } = await setupPromise

    beforeSetupState = await ethereumClient.makeSnapshot()
    // Avoid seting up test cases for each test
    await setupTestCases()
  })

  afterAll(async () => {
    const { ethereumClient } = await setupPromise

    return ethereumClient.revertSnapshot(beforeSetupState)
  })

  test('It should allow to add a new token pair', async () => {
    // GIVEN a not approved token pair
    let isRdnEthApproved = await _getIsApprovedMarket({})
    expect(isRdnEthApproved).toBeFalsy()

    // GIVEN a initial state that shows there haven't been any previous auction
    let rdnEthstateInfo = await _getStateInfo({})
    expect(rdnEthstateInfo).toEqual(UNKNOWN_PAIR_MARKET_STATE)

    // GIVEN a state status of UNKNOWN_TOKEN_PAIR
    let rdnEthState = await _getState({})
    expect(rdnEthState).toEqual('UNKNOWN_TOKEN_PAIR')

    // WHEN we add a new token pair
    await _addRdnEthTokenPair({})

    // THEN the new state matches the intial market state
    rdnEthstateInfo = await _getStateInfo({})
    expect(rdnEthstateInfo).toMatchObject(INITIAL_MARKET_STATE)

    // THEN the new state status is WAITING_FOR_AUCTION_TO_START
    rdnEthState = await _getState({})
    expect(rdnEthState).toEqual('WAITING_FOR_AUCTION_TO_START')

    // THEN the market is now approved
    isRdnEthApproved = await _getIsApprovedMarket({})
    expect(isRdnEthApproved).toBeTruthy()
  })

  // Add funds to auction (sell tokens in auction)
  test('It should allow to add funds to an auction', async () => {
    jest.setTimeout(10000)
    const { user1, buySell } = await setupPromise

    // GIVEN a not approved token pair
    let isRdnEthApproved = await _getIsApprovedMarket({})
    expect(isRdnEthApproved).toBeFalsy()

    // GIVEN a state status of UNKNOWN_TOKEN_PAIR
    let rdnEthState = await _getState({})
    expect(rdnEthState).toEqual('UNKNOWN_TOKEN_PAIR')

    // WHEN we add a new token pair
    await _addRdnEthTokenPair({})

    // WHEN we add a new sell token order
    await buySell('postSellOrder', {
      from: user1,
      sellToken: 'RDN',
      buyToken: 'ETH',
      amount: parseFloat('2')
    })

    // THEN the new state matches the intial market state
    let updatedAuction = Object.assign({}, INITIAL_MARKET_STATE.auction,
      { sellVolume: new BigNumber('1990000000000000000') })
    let updatedMarket = Object.assign({}, INITIAL_MARKET_STATE, { auction: updatedAuction })
    let rdnEthstateInfo = await _getStateInfo({})
    expect(rdnEthstateInfo).toMatchObject(updatedMarket)

    // THEN the new state status is WAITING_FOR_AUCTION_TO_START
    rdnEthState = await _getState({})
    expect(rdnEthState).toEqual('WAITING_FOR_AUCTION_TO_START')

    // THEN the market is now approved
    isRdnEthApproved = await _getIsApprovedMarket({})
    expect(isRdnEthApproved).toBeTruthy()
  })

  // Test buy tokens in auction
  test('It should allow to buy tokens in an auction', async () => {
    jest.setTimeout(10000)
    const { user1, buySell, ethereumClient } = await setupPromise

    // GIVEN a not approved token pair
    let isRdnEthApproved = await _getIsApprovedMarket({})
    expect(isRdnEthApproved).toBeFalsy()

    // GIVEN a state status of UNKNOWN_TOKEN_PAIR
    let rdnEthState = await _getState({})
    expect(rdnEthState).toEqual('UNKNOWN_TOKEN_PAIR')

    // WHEN we add a new token pair
    await _addRdnEthTokenPair({})

    // THEN the new state status is WAITING_FOR_AUCTION_TO_START
    rdnEthState = await _getState({})
    expect(rdnEthState).toEqual('WAITING_FOR_AUCTION_TO_START')

    // THEN the new state status is WAITING_FOR_AUCTION_TO_START
    // for oposite market too
    rdnEthState = await _getState({ sellToken: 'ETH', buyToken: 'RDN' })
    expect(rdnEthState).toEqual('WAITING_FOR_AUCTION_TO_START')

    // WHEN we increase time in 6 hours
    await ethereumClient.increaseTime(6.1 * 60 * 60)

    // THEN the new state status is RUNNING
    rdnEthState = await _getState({})
    expect(rdnEthState).toEqual('RUNNING')

    // THEN the new state status is RUNNING
    // for oposite market too
    rdnEthState = await _getState({ sellToken: 'ETH', buyToken: 'RDN' })
    expect(rdnEthState).toEqual('RUNNING')

    // WHEN we add a buy order
    await buySell('postBuyOrder', {
      from: user1,
      sellToken: 'ETH',
      buyToken: 'RDN',
      amount: parseFloat('0.5')
    })

    // THEN the new state matches the intial market state
    let updatedAuctionOpp = Object.assign({}, INITIAL_MARKET_STATE.auctionOpp,
      { buyVolume: new BigNumber('497500000000000000') })
    let updatedMarket = Object.assign({}, INITIAL_MARKET_STATE, { auctionOpp: updatedAuctionOpp })
    let rdnEthstateInfo = await _getStateInfo({})
    expect(rdnEthstateInfo).toMatchObject(updatedMarket)
  })

  // Test auction closing
  test('It should close auction after all tokens sold', async () => {
    jest.setTimeout(10000)
    const { user1, buySell, ethereumClient } = await setupPromise

    // GIVEN a not approved token pair
    let isRdnEthApproved = await _getIsApprovedMarket({})
    expect(isRdnEthApproved).toBeFalsy()

    // GIVEN a state status of UNKNOWN_TOKEN_PAIR
    let rdnEthState = await _getState({})
    expect(rdnEthState).toEqual('UNKNOWN_TOKEN_PAIR')

    // WHEN we add a new token pair
    await _addRdnEthTokenPair({rdnFunding: 0.5})

    // THEN the new state status is WAITING_FOR_AUCTION_TO_START
    rdnEthState = await _getState({})
    expect(rdnEthState).toEqual('WAITING_FOR_AUCTION_TO_START')

    // expect(await auctionRepo.getStateInfo({ sellToken: 'RDN', buyToken: 'ETH' }))
    //   .toMatchObject(INITIAL_MARKET_STATE)

    // WHEN we increase time in 6 hours
    await ethereumClient.increaseTime(6.1 * 60 * 60)

    // THEN the new state status is RUNNING
    rdnEthState = await _getState({})
    expect(rdnEthState).toEqual('RUNNING')

    // WHEN we add a buy order for all tokens of one auction side
    await buySell('postBuyOrder', {
      from: user1,
      sellToken: 'RDN',
      buyToken: 'ETH',
      amount: parseFloat('0.5')
    })

    // THEN the new state matches that one auction has closed, with a closing price
    let updatedAuction = Object.assign({}, // INITIAL_MARKET_STATE.auction,
      {
        buyVolume: new BigNumber('4018084907660346'),
        closingPrice: {
          numerator: new BigNumber('4018084907660346'),
          denominator: new BigNumber('498750000000000000')
        },
        isClosed: true,
        isTheoreticalClosed: true,
        sellVolume: new BigNumber('498750000000000000')
      })
    let updatedAuctionOpp = Object.assign({}, INITIAL_MARKET_STATE.auctionOpp,
      {sellVolume: new BigNumber('13062834446704545454')})
    let updatedMarket = Object.assign({}, INITIAL_MARKET_STATE, { auction: updatedAuction, auctionOpp: updatedAuctionOpp })
    let rdnEthstateInfo = await _getStateInfo({})
    expect(rdnEthstateInfo).toMatchObject(updatedMarket)

    // THEN the new state status is ONE_AUCTION_HAS_CLOSED
    rdnEthState = await _getState({})
    expect(rdnEthState).toEqual('ONE_AUCTION_HAS_CLOSED')
  })
})

// ********* Test helpers *********
const UNKNOWN_PAIR_MARKET_STATE = {
  'auction': null,
  'auctionIndex': 0,
  'auctionOpp': null,
  'auctionStart': null
}

const INITIAL_MARKET_STATE = {
  auctionIndex: 1,
  auction: {
    buyVolume: new BigNumber('0'),
    closingPrice: null,
    isClosed: false,
    isTheoreticalClosed: false,
    sellVolume: new BigNumber('0')
  },
  auctionOpp: {
    buyVolume: new BigNumber('0'),
    closingPrice: null,
    isClosed: false,
    isTheoreticalClosed: false,
    sellVolume: new BigNumber('13062839545454545454')
  }
}

async function _getIsApprovedMarket ({ tokenA = 'RDN', tokenB = 'ETH' }) {
  const { auctionRepo } = await setupPromise

  return auctionRepo.isApprovedMarket({ tokenA, tokenB })
}

async function _getStateInfo ({ sellToken = 'RDN', buyToken = 'ETH' }) {
  const { auctionRepo } = await setupPromise

  return auctionRepo.getStateInfo({ sellToken, buyToken })
}

async function _getState ({ sellToken = 'RDN', buyToken = 'ETH' }) {
  const { auctionRepo } = await setupPromise

  return auctionRepo.getState({ sellToken, buyToken })
}

async function _addRdnEthTokenPair ({ rdnFunding = 0, ethFunding = 13.123 }) {
  const { web3, auctionRepo, user1 } = await setupPromise

  await auctionRepo.addTokenPair({
    from: user1,
    tokenA: 'RDN',
    tokenAFunding: web3.toWei(rdnFunding, 'ether'),
    tokenB: 'ETH',
    tokenBFunding: web3.toWei(ethFunding, 'ether'),
    initialClosingPrice: {
      numerator: 4079,
      denominator: 1000000
    }
  })
}
