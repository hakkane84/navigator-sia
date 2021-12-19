// Handles the API for the "Web3Index" project (https://web3index.org/)
var fs = require('fs');
var cron = require('cron');
var SqlAsync = require('./sql_async.js')
var SqlComposer = require("./sql_composer.js")

exports.CreateApi = async function(params) {
    // Routine for creating, four times per day, a JSON file containing the API for the Web3Index

    // Adapting Web3Index methodology to Sia, "Revenue" is calculated as the value spent by Sia renters to hosts for their
    // storage services. This is the sum of three different concepts (or fees):
    // * Fees paid to the hosts for their service (storage, bandwidth, etc): it is calculated from the amount depostided on the
    //   file contracts (the Allowance) minus the amount that remains unspent and gets returned at the end of the
    //   contract. This value is transformed into USD at the exchange rate of the end of the contract (when the nspent fraction
    //   of the allowance is reurned)
    // * Miner fees (fees for including the file contract on the blockchain), transformed to USD at the date of the
    //   contract formation. Marginal, less than 1SC
    // * SiaFund fees (the 3.9% of the total contract value, which is paid to the holders of the secondary token SiaFund),
    //   transformed to USD at the date of the contract formation

    // API creation 4 times per day
    var cronJob = cron.job("00 00 00,06,12,18 * * *", function(){
        if (params.useCoinGeckoPrices == true) {
            apiFormation(params)
        }
    })
    cronJob.start();
}

async function apiFormation(params) {
    // Number of days to be displayed on the days array of the API
    var daysInApi = 180

    // Relevant timestamps
    var start = new Date();
    start.setUTCHours(0,0,0,0);
    var today = Math.round(start.getTime()/1000)

    // A - Current height
    var sqlQuery = SqlComposer.SelectTop(params, "BlockInfo", "Height", "Height", 1)
    var sql = await SqlAsync.Sql(params, sqlQuery)
    var currentHeight = sql[0].Height
    var blockchainDays = Math.ceil(currentHeight / 144) // Days the blocckchain has existed. 144 blocks per day
    var genesisDate = today - (blockchainDays * 86400) // Aprox. date of the genesis
    
    // B - SQL query 1: USD prices
    var sqlQuery = "SELECT Timestamp, USD FROM ExchangeRates ORDER By Timestamp DESC"
    var pricesSql = await SqlAsync.Sql(params, sqlQuery)
    // Transforming the array into an object, for faster lookup
    var pricesDict = {}
    for (var i = 0; i < pricesSql.length; i++) {
        pricesDict[pricesSql[i].Timestamp] = pricesSql[i].USD
    }

    // C - SQL query 2: Contracts
    var sqlQuery = "SELECT HostValue, ValidProof1Value, ValidProof2Value, Fees, Height, Timestamp, WindowEnd "
        + "From ContractInfo ORDER BY Height ASC"
    var contractsSql = await SqlAsync.Sql(params, sqlQuery)

    // D1 - Initializing array with 180 (daysInApi) recent days and a dictionary for faster assignement
    var days = []
    for (var i = 0; i < blockchainDays; i++) {
        days.push({
            date: (genesisDate + (i * 86400)),
            revenue: 0
        })
    }
    daysDict = {}
    for (var i = 0; i < days.length; i++) {
        daysDict[days[i].date] = 0
    }

    // D2 - Initializing accumulators of revenue
    var sixMonthsAgoRevenue = 0
    var ninetyDaysAgoRevenue = 0
    var sixtyDaysAgoRevenue = 0
    var thirtyDaysAgoRevenue = 0
    var twoWeeksAgoRevenue = 0
    var oneWeekAgoRevenue = 0
    var twoDaysAgoRevenue = 0
    var oneDayAgoRevenue = 0
    var nowRevenue = 0
    
    // E - Loop building the revenue figures in USD
    for (var i = 0; i < contractsSql.length; i++) {
        var contract = contractsSql[i]

        // E1 - Miner fees and SiaFund fees, paid at the moment of the contract formation
        // SiaFund fees - a 3.9% (params.blockchain.siafundFees) of the total contract value. Total contract value is calcualted
        // from the two valid proof outputs plus the miner fees and that extra 3.9%
        var contractValue = (contract.ValidProof1Value + contract.ValidProof2Value + contract.Fees) 
            / (1 - params.blockchain.siafundFees)
        var sfFees = contractValue * params.blockchain.siafundFees
        
        // Total fees: SF fees + miner fees
        var sc = sfFees + contract.Fees
        var networkFees = await convertUSD(params, sc, contract.Timestamp, pricesDict)

        // E2 - Fees paid to the host, calculated at the end of the contract (block indicated at WindowEnd)
        // This is = Allowance deposited by the renter - Returned allowance at the end of the contract
        // * As some contracts are made from either 1, 2, 3 or more Siacoin inputs deposited by the renter, to simplify
        //   we calculate it as the coins locked on the contract minus the input deposited by the host as collateral.
        //   This is based on the assumption that in all the contracts, the input from the host is the last one in the list
        //   Every contract on the Sia blockchain so far respects this non-written rule. It is messy to make this assumption,
        //   but at the time being this is the sole possible way to calculate how much the renter spent in allowance
        // * Returned allowance is ValidProof1Value, as the Navigator database already has this value updated from the latest
        //   contract revision on the contracts database
        var renterAllowance = contract.ValidProof1Value + contract.ValidProof2Value - contract.HostValue
        var sc = renterAllowance - contract.ValidProof1Value
        // Sanity check. No contract currently meets this, but in case of a bug prevents negative values. We err 
        // with a conservative Revenue value
        if (sc <= 0) { sc = 0 } 
        var hostFees = await convertUSD(params, sc, contract.Timestamp, pricesDict)

        // Network fees accrued on each day, to be included on the "days" array
        var contractDay = dayStart(contract.Timestamp) // Start of the day of the contract
        daysDict[contractDay] = daysDict[contractDay] + networkFees
        
        // Host fees accrued on each day
        // Estimated timestamp for the end of the contract, considering on average, one block on Sia is 10 min, or 600 secs
        var contractEndTimestamp = parseInt(contract.Timestamp) + ((parseInt(contract.WindowEnd) - parseInt(contract.Height)) * 600)
        var contracEndDay = dayStart(contractEndTimestamp)
        daysDict[contracEndDay] = daysDict[contracEndDay] + hostFees
    }

    // F - API building
    for (var i = 0; i < days.length; i++) {
        days[i].revenue =  parseFloat(daysDict[days[i].date].toFixed(2))
    }
    // Sorting in ascending date order
    days.sort(function(a, b) {
        return parseInt(a.date) - parseInt(b.date);
    });

    // Revenue accumulators
    for (var i = 0; i < days.length; i++) {
        nowRevenue = nowRevenue + days[i].revenue
        if (days[i].date < today - (86400 * 180)) {
            sixMonthsAgoRevenue = sixMonthsAgoRevenue + days[i].revenue
        }
        if (days[i].date < today - (86400 * 90)) {
            ninetyDaysAgoRevenue = ninetyDaysAgoRevenue + days[i].revenue
        }
        if (days[i].date < today - (86400 * 60)) {
            sixtyDaysAgoRevenue = sixtyDaysAgoRevenue + days[i].revenue
        }
        if (days[i].date < today - (86400 * 30)) {
            thirtyDaysAgoRevenue = thirtyDaysAgoRevenue + days[i].revenue
        }
        if (days[i].date < today - (86400 * 14)) {
            twoWeeksAgoRevenue = twoWeeksAgoRevenue + days[i].revenue
        }
        if (days[i].date < today - (86400 * 7)) {
            oneWeekAgoRevenue = oneWeekAgoRevenue + days[i].revenue
        }
        if (days[i].date < today - (86400 * 2)) {
            twoDaysAgoRevenue = twoDaysAgoRevenue + days[i].revenue
        }
        if (days[i].date < today - 86400) {
            oneDayAgoRevenue = oneDayAgoRevenue + days[i].revenue
        }
    }

    // Trimming to the last daysInApi from days array
    days = days.slice(days.length - daysInApi)

    // Final API structure
    var finalApi = {
        revenue: {
            now: parseFloat(nowRevenue.toFixed(2)),
            oneDayAgo: parseFloat(oneDayAgoRevenue.toFixed(2)),
            twoDaysAgo: parseFloat(twoDaysAgoRevenue.toFixed(2)),
            oneWeekAgo: parseFloat(oneWeekAgoRevenue.toFixed(2)),
            twoWeeksAgo: parseFloat(twoWeeksAgoRevenue.toFixed(2)),
            thirtyDaysAgo: parseFloat(thirtyDaysAgoRevenue.toFixed(2)),
            sixtyDaysAgo: parseFloat(sixtyDaysAgoRevenue.toFixed(2)),
            ninetyDaysAgo: parseFloat(ninetyDaysAgoRevenue.toFixed(2)),
            sixMonthsAgo: parseFloat(sixMonthsAgoRevenue.toFixed(2))
        },
        days: days
    }

    // G - Saving API file
    fs.writeFileSync("revenue_api.json", JSON.stringify(finalApi))
    console.log("* Revenue API - Updated. 24-hour: $ " + parseInt(nowRevenue - oneDayAgoRevenue) 
        + " 30-day: $" + parseInt(nowRevenue - thirtyDaysAgoRevenue)
        + " 90-day: $" + parseInt(nowRevenue - ninetyDaysAgoRevenue))
}

async function convertUSD(params, sc, timestamp, pricesDict) {
    // Getting the start of the day
    var day = dayStart(timestamp)

    // Reading the dictionary of prices for the USD conversion
    var value = (sc / params.blockchain.coinPrecision * pricesDict[day])
    if (value == null || value == undefined || value !== value) {
        value = 0
    }
    return value
}

function dayStart(timestamp) {
    var dayStart = new Date(timestamp*1000);
    dayStart.setUTCHours(0,0,0,0);
    var day = Math.round(dayStart.getTime()/1000)
    return day
}
