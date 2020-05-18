// Tasks related to the table of exchange rates
var exports = module.exports={}
var axios = require('axios');
var Commons = require('./commons.js')
var ExchangeRates = require('./exchangerates.js')
var SqlAsync = require('./sql_async.js')
var SqlComposer = require("./sql_composer.js")

exports.PopulateExchangeData = async function(params, currencyNum, attempt) {
    // Requests exchange rates from the coingecko API for each currency in params.exchangeCurrencies

    if (currencyNum < params.exchangeCurrencies.length) { // If this is not the last currency
        var apiAddress = "https://api.coingecko.com/api/v3/coins/siacoin/market_chart?vs_currency=" + params.exchangeCurrencies[currencyNum] + "&days=max"
        console.log("* Getting " + params.exchangeCurrencies[currencyNum] + " from CoinGecko")
        
        await axios.get(apiAddress).then(async function (response) {
            var api = response.data.prices
            await insertExchangeRates(api, params, currencyNum, attempt)
        }).catch(async function (error){
            // Next attempt after 30 seconds
            console.log("// Failed getting data for " + params.exchangeCurrencies[currencyNum] + ". Repeating in 30 seconds")
            if (attempt < 3) {
                attempt++
                await Commons.Delay(30000);
                await ExchangeRates.PopulateExchangeData(params, currencyNum, attempt)
            } else {
                // Move to the next
                console.log("//// Coingecko failed to provide data for " + params.exchangeCurrencies[currencyNum])
                attempt = 0
                currencyNum++
                // next after timeout
                await Commons.Delay(5000);
                await ExchangeRates.PopulateExchangeData(params, currencyNum, attempt)
            }
        })
        
    } else {
        console.log("* Exchange rates database building complete!")

        // Siafunds
        await ExchangeRates.PopulateSiafundExchangeRates(params, 0)
    }
}

exports.PopulateSiafundExchangeRates = async function(params, attempt) {
    // Updates the data on the exchanges database with Siafund rates from Bisq
    console.log("* Getting SF rates from Bisq")
    
    var apiAddress = "https://markets.bisq.network/api/trades?market=sf_btc&limit=100000"
    await axios.get(apiAddress).then(async function (response) {
        var api = response.data
        await insertSiafundRates(params, api)
        
    }).catch(async function (error) {
        // Next attempt after 30 seconds
        console.log("// Failed getting data from Bisq. Repeating in 1 minute")
        if (attempt < 3) {
            attempt++
            await Commons.Delay(60000);
            await ExchangeRates.PopulateSiafundExchangeRates(params, attempt)
        } else {
            // Failed
            console.log("//// Failed getting SiaFund rates from Bisq")
        }
    })
}

async function insertSiafundRates(params, api) {
    // Updating SQL values with SF data
    api.reverse()
    var firstDay = Commons.GetStartDayTimestamp(api[0].trade_date)
    var now = new Date().getTime();
    var today = Commons.GetStartDayTimestamp(now)

    // Number of days between firstDay and today
    var days = Math.round((today - firstDay) / 86400)

    // Building an empty matrix of prices
    var arrayTrades = []
    for (var i = 0; i < days; i++) {
        arrayTrades.push({
            value: 0, // Acumulated prices for trades that day
            amount: 0 // Amount of SF traded that day
        })
    }

    // Populating matrix with trades from API
    for (var i = 0; i < api.length; i++) {
        var tradeDay = Commons.GetStartDayTimestamp(api[i].trade_date) // Start of the day of this trade
        // Transforming tradeDay into a day number, being 0 the first day of trades (the position of arrayTrades[])
        var day = Math.round((tradeDay - firstDay) / 86400)
        arrayTrades[day].value = arrayTrades[day].value + (parseFloat(api[i].price) * parseInt(api[i].amount))
        arrayTrades[day].amount = arrayTrades[day].amount + parseInt(api[i].amount)
    }
    
    // Getting the SC<->BTC rates from the database
    var sqlQuery = "SELECT Timestamp, BTC FROM ExchangeRates"
    var btcPrices = await SqlAsync.Sql(params, sqlQuery)

    // Averaging the price each day and placing the date on the array
    for (var i = 0; i < arrayTrades.length; i++) {
        if (arrayTrades[i].value == 0) {
            // No trade this day, use previous day price
            btc = arrayTrades[i-1].priceBtc
        } else {
            // Average of trades
            btc = arrayTrades[i].value / arrayTrades[i].amount
        }
        arrayTrades[i].priceBtc = btc
        time = (i * 86400) + firstDay

        // Matching date to the array of btc prices, and transforming to SC
        for (var j = 0; j < btcPrices.length; j++) {
            if ((time > parseInt(btcPrices[j].Timestamp) - 43000) 
                && (time < parseInt(btcPrices[j].Timestamp) + 43000)) { // Some error allowed
                arrayTrades[i].priceSc = (parseFloat(btcPrices[j].BTC) / arrayTrades[i].priceBtc).toFixed(18)
                
                // Correcting the timestamp, matching the database
                arrayTrades[i].time = btcPrices[j].Timestamp
            }
        }

        // SQL insertion
        var sqlQuery = "UPDATE ExchangeRates"
            + " SET SF=" + arrayTrades[i].priceSc
            + " WHERE Timestamp=" + arrayTrades[i].time
        await SqlAsync.Sql(params, sqlQuery)
    }
    console.log("* SF Exchange rates insertion done!")
}

async function insertExchangeRates(api, params, currencyNum, attempt) {
    // Updating SQL values or inserting if they don't exist
    for (var i = 0; i < api.length; i++) {
        var timestamp = await ExchangeRates.DayBeginTime(api[i][0])
        // MS-SQL
        var sqlQuery = "IF (NOT EXISTS(SELECT * FROM ExchangeRates WHERE Timestamp=" + timestamp + "))" 
            + " BEGIN"
                + " INSERT INTO ExchangeRates(Timestamp, " + params.exchangeCurrencies[currencyNum] + ")"
                + " VALUES(" + timestamp + ", " + api[i][1] + ")"
            + " END"
            + " ELSE"
            + " BEGIN"
                + " UPDATE ExchangeRates"
                + " SET " + params.exchangeCurrencies[currencyNum] + "=" + api[i][1]
                + " WHERE Timestamp=" + timestamp
            + " END"

        // Adapting the syntax to particularities of SQLite
        if (params.useMsSqlServer == false) {
            sqlQuery = SqlComposer.SqLiteAdapter(sqlQuery)
        }

        try {
            await SqlAsync.Sql(params, sqlQuery)
        } catch (e) {
            console.log("// Error inserting " + timestamp + " into " + params.exchangeCurrencies[currencyNum])
        }  
    }
    
    // Next currency after timeout 10sec
    attempt = 0
    currencyNum++
    await Commons.Delay(10000);
    await ExchangeRates.PopulateExchangeData(params, currencyNum, attempt)
}

exports.DayBeginTime = async function(UNIX_timestamp) {
    // Unix timestmap of 12:00am of a certain timestamp
    var round = Math.floor(UNIX_timestamp/86400000) * 86400
    return round
}


exports.DailyExchangeData = async function(params) {
    // Gets updated exchange rates and saves them once per day
    
    console.log("* Updating exchange rates from CoinGecko")
    var apiAddress = "https://api.coingecko.com/api/v3/coins/siacoin?localization=false&tickers=false&community_data=false&developer_data=false&sparkline=false"
    
    await axios.get(apiAddress).then(async function (response) {
        var api = response.data.market_data.current_price
        var timestamp = await ExchangeRates.DayBeginTime(new Date().getTime())

        // Composing the SQL query
        var sqlQuery = "IF (NOT EXISTS(SELECT * FROM ExchangeRates WHERE Timestamp=" + timestamp + "))" 
            + " BEGIN"
                + " INSERT INTO ExchangeRates(Timestamp, " 

        for (var i = 0; i < params.exchangeCurrencies.length; i++) {
            sqlQuery = sqlQuery + params.exchangeCurrencies[i] 
            
            if (i < (params.exchangeCurrencies.length - 1)) {
                sqlQuery = sqlQuery +  ", "
            }
        }

        sqlQuery = sqlQuery + ")"
                + " VALUES(" +  timestamp + ", "

        for (var i = 0; i < params.exchangeCurrencies.length; i++) {
            sqlQuery = sqlQuery + api[params.exchangeCurrencies[i].toLowerCase()]
            
            if (i < (params.exchangeCurrencies.length - 1)) {
                sqlQuery = sqlQuery +  ", "
            }
        }

        sqlQuery = sqlQuery + ")" 
            + " END"
            + " ELSE"
            + " BEGIN"
                + " UPDATE ExchangeRates"
                + " SET " //+ params.exchangeCurrencies[currencyNum] + "=" + api[i][1]

        for (var i = 0; i < params.exchangeCurrencies.length; i++) {
            sqlQuery = sqlQuery + params.exchangeCurrencies[i] + "=" + api[params.exchangeCurrencies[i].toLowerCase()]
            
            if (i < (params.exchangeCurrencies.length - 1)) {
                sqlQuery = sqlQuery +  ", "
            }
        }
        
        sqlQuery = sqlQuery + " WHERE Timestamp=" + timestamp
            + " END"
        
        //console.log(sqlQuery)
        await updateExchangeData(params, sqlQuery, timestamp)


    }).catch(async function (error){
        // Next attempt after 10 minutes
        console.log("// Failed getting updated data from CoinGecko. Repeating in 10 minutes")
        //console.log(error)

        setTimeout(function(){
            ExchangeRates.DailyExchangeData(params)
        }, 600000);
    })
}

async function updateExchangeData(params, sqlQuery, timestamp) {
    // Executes the data update
    try {
        // Adapting the syntax to particularities of SQLite
        if (params.useMsSqlServer == false) {
            sqlQuery = SqlComposer.SqLiteAdapter(sqlQuery)
        }

        await SqlAsync.Sql(params, sqlQuery)
        console.log("* Exchange rates data successfully updated")
    } catch (e) {
        console.log("// Error inserting the exchange rates data")
        console.log(e)
    }
    await dailySiafundExchangeData(params, timestamp)
}

async function dailySiafundExchangeData(params, timestamp) {
    // Collects current SF exchange rate and updates the table
    var apiAddress = "https://markets.bisq.network/api/ticker?market=sf_btc"

    await axios.get(apiAddress).then(async function (response) {
        var api = response.data
        var btc = parseFloat(api[0].last)
        await updateCurrentSiafundExchange(params, timestamp, btc)
        
    }).catch(async function (error) {
        // Next attempt after 10 minutes
        console.log("// Failed getting updated data from Bisq. Repeating in 10 minutes")
        //console.log(error)
        
        setTimeout(function(){
            dailySiafundExchangeData(params, timestamp)
        }, 600000);
    })
}

async function updateCurrentSiafundExchange(params, timestamp, btc) {
    // Saves the current SF price in the database

    // Getting the current BTC<->SC
    var sqlQuery = "SELECT Timestamp, BTC FROM ExchangeRates WHERE Timestamp=" + timestamp
    var btcPrices = await SqlAsync.Sql(params, sqlQuery)
    var scToBtc = btcPrices[0].BTC

    var priceInSc = (scToBtc / btc).toFixed(18)
    
    // SQL insertion
    var sqlQuery = "UPDATE ExchangeRates"
        + " SET SF=" + priceInSc
        + " WHERE Timestamp=" + timestamp
    await SqlAsync.Sql(params, sqlQuery)

    console.log("* Siafund rates data successfully updated")
}