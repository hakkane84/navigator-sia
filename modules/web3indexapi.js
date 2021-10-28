// Handles the API for the "Web3Index" project (https://web3index.org/)
var fs = require('fs');
var cron = require('cron');
var SqlAsync = require('./sql_async.js')
var SqlComposer = require("./sql_composer.js")

exports.CreateApi = async function(params) {
    // Routine for creating, four times per day, a JSON file containing the API for the Web3Index

    // Adapting Web3Index methodology to Sia, "Revenue" is calculated as the value of file contracts
    // (value = the allowance of the renter + the collateral from the host) transformed into USD at the exchange rate of
    // Siacoin on the day each individual contract was formed

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
    var sixMonthsAgo = today - (86400 * 180)

    // A - SQL query 1: Current height
    var sqlQuery = SqlComposer.SelectTop(params, "BlockInfo", "Height", "Height", 1)
    var sql = await SqlAsync.Sql(params, sqlQuery)
    var currentHeight = sql[0].Height
    
    // B - SQL query 2: USD prices
    var sqlQuery = "SELECT Timestamp, USD FROM ExchangeRates ORDER By Timestamp DESC"
    var pricesSql = await SqlAsync.Sql(params, sqlQuery)
    // Transforming the array into an object, for faster lookup
    var pricesDict = {}
    for (var i = 0; i < pricesSql.length; i++) {
        pricesDict[pricesSql[i].Timestamp] = pricesSql[i].USD
    }

    // C - SQL query 3: Contracts from the last years
    var sqlQuery = "SELECT ValidProof1Value, ValidProof2Value, Fees, Height, Timestamp From ContractInfo ORDER BY Height ASC"
    var contractsSql = await SqlAsync.Sql(params, sqlQuery)

    // D1 - Initializing array with 180 (daysInApi) recent days and a dictionary for faster assignement
    var days = []
    for (var i = 0; i < daysInApi; i++) {
        days.push({
            date: (sixMonthsAgo + (i * 86400)),
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
        var contractValue = await convertUSD(params, contractsSql[i], contractsSql[i].Timestamp, pricesDict)

        // Revenue accumulators
        if (contractsSql[i].Height < (currentHeight - (180 * 144))) {
            sixMonthsAgoRevenue = sixMonthsAgoRevenue + contractValue
        }
        if (contractsSql[i].Height < (currentHeight - (90 * 144))) {
            ninetyDaysAgoRevenue = ninetyDaysAgoRevenue + contractValue
        }
        if (contractsSql[i].Height < (currentHeight - (60 * 144))) {
            sixtyDaysAgoRevenue = sixtyDaysAgoRevenue + contractValue
        }
        if (contractsSql[i].Height < (currentHeight - (30 * 144))) {
            thirtyDaysAgoRevenue = thirtyDaysAgoRevenue + contractValue
        }
        if (contractsSql[i].Height < (currentHeight - (14 * 144))) {
            twoWeeksAgoRevenue = twoWeeksAgoRevenue + contractValue
        }
        if (contractsSql[i].Height < (currentHeight - (7 * 144))) {
            oneWeekAgoRevenue = oneWeekAgoRevenue + contractValue
        }
        if (contractsSql[i].Height < (currentHeight - (2 * 144))) {
            twoDaysAgoRevenue = twoDaysAgoRevenue + contractValue
        }
        if (contractsSql[i].Height < (currentHeight - 144)) {
            oneDayAgoRevenue = oneDayAgoRevenue + contractValue
        }
        nowRevenue = nowRevenue + contractValue

        // Only contracts from the last 180 days
        if (contractsSql[i].Height > (currentHeight - (daysInApi * 144))) {
            // Contract value accrued on each day, to be included on the "days" array
            var contractDay = dayStart(contractsSql[i].Timestamp) // Start of the day of the contract
            daysDict[contractDay] = daysDict[contractDay] + contractValue
        }      
    }

    // F - API building
    for (var i = 0; i < days.length; i++) {
        days[i].revenue =  parseFloat(daysDict[days[i].date].toFixed(2))
    }
    // Sorting in ascending date order
    days.sort(function(a, b) {
        return parseInt(a.date) - parseInt(b.date);
    });

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
            sixMonthsAgo: parseFloat(sixMonthsAgoRevenue.toFixed(2)),
            days: days
        }
    }

    // G - Saving API file
    fs.writeFileSync("revenue_api.json", JSON.stringify(finalApi))
    console.log("* Revenue API - Updated. 30-day revenue: $" + parseInt(nowRevenue - thirtyDaysAgoRevenue))
}

async function convertUSD(params, contract, timestamp, pricesDict) {
    // Getting the start of the day
    var day = dayStart(timestamp)

    // Total contract value, in SC. It is calculated from the value of the outputs in case of a valid Proof of Storage, plus
    // the miner fees, plus the 3.9% of network fees paid to the SiaFund holders
    var sc = (contract.ValidProof1Value + contract.ValidProof2Value + contract.Fees) / (1 - params.blockchain.siafundFees)

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
