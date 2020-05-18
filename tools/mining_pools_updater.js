// mining_pools_updater.js - A tool for updating the mining pools that mined blocks in the Navigator database
// Github: https://github.com/hakkane84/navigator-sia
// License: GNU AGPLv3
// Author: Salvador Herrera (keops_cc@outlook.com)

// Usage: add as an argument the file path containing the pools address list (a JSON)
// Example: `node mining_pools_updater.js ../poolsAddresses.json`

// Load configuration file
var fs = require('fs');
var stripJsonComments = require('strip-json-comments')
var rawFile = fs.readFileSync("../config.json").toString()
var config = JSON.parse(stripJsonComments(rawFile))

// Loads all the parameters and functions, from the external params.js module
var Params = require('../modules/params.js')
var params = Params.Params(config, "../")

var SqlAsync = require('../modules/sql_async.js')


if (process.argv[2] == null) {
    // Wrong syntax
    console.log("* Wrong syntax: the path of an addresses book file needs to be provided")
    console.log("* Example: node mining_pools_updater.js ../poolsAddresses.json")
    process.exit()
} else {
    try {
        var fileData = fs.readFileSync(process.argv[2])
        var poolsDb = JSON.parse(fileData)
        setTimeout(function(){
            main(poolsDb)
        }, 3000)
        
    } catch (e) {
        console.log("* Error opening the file:")
        console.log(e)
        process.exit()
    }
}


async function main(poolsDb) {

    // First we reset the pools to "Unknown"
    var sqlQuery = "UPDATE BlockInfo SET MiningPool = 'Unknown'"
    await SqlAsync.Sql(params, sqlQuery)
    console.log("* Pools info reseted")

    // Iterating pools
    console.log("* Updating " + poolsDb.length + " pools...")
    for (var i = 0; i < poolsDb.length; i++) {
        console.log("\n*** " + poolsDb[i].name.toUpperCase() + " ***")

        for (var j = 0; j < poolsDb[i].addresses.length; j++) {
            console.log(poolsDb[i].addresses[j])
            if (poolsDb[i].name == "AntPool") {
                var sqlQuery = "UPDATE BlockInfo SET MiningPool = '" + poolsDb[i].name + "' WHERE MinerPayoutAddress = '" + poolsDb[i].addresses[j] + "' AND Height > 132200" 
            } else {
                var sqlQuery = "UPDATE BlockInfo SET MiningPool = '" + poolsDb[i].name + "' WHERE MinerPayoutAddress = '" + poolsDb[i].addresses[j] + "'"
            }

            // Sending the SQL query to the controller
            await SqlAsync.Sql(params, sqlQuery)
        }
    }

    console.log("* Done")
    setTimeout(function(){
        process.exit()
    }, 5000)
}