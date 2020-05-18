// Database_reset.js - A tool for deleting all the contents of a Navigator database
// Github: https://github.com/hakkane84/navigator-sia
// License: GNU AGPLv3
// Author: Salvador Herrera (keops_cc@outlook.com)

// Warning: this script will delete all the contents of the database irreversibly

var fs = require('fs');
var stripJsonComments = require('strip-json-comments')

// Load configuration file
var rawFile = fs.readFileSync("../config.json").toString()
var config = JSON.parse(stripJsonComments(rawFile))

// Loads all the parameters and functions, from the external params.js module
var Params = require('../modules/params.js')
var params = Params.Params(config, "../")

var readline = require('readline').createInterface({
    input: process.stdin,
    output: process.stdout
});
var SqlAsync = require('../modules/sql_async.js')

setTimeout(function() {
    readline.question('WARNING: This operation will delete the database of Navigator irreversibly. Proceed (y/n)?', name => {
        if (name == "y") {
            main()
        } else {
            console.log("OPERATION CANCELED\n")
        }
        readline.close();
    });
}, 3000)

async function main() {
    var dropTables = [
        "DROP TABLE BlockInfo",
        "DROP TABLE AddressChanges",
        "DROP TABLE BlockTransactions",
        "DROP TABLE ContractInfo",
        "DROP TABLE ContractResolutions",
        "DROP TABLE HashTypes",
        "DROP TABLE HostAnnInfo",
        "DROP TABLE RevisionsInfo",
        "DROP TABLE TxInfo",
        "DROP TABLE Outputs",
        "DROP TABLE AddressesBalance",
        "DROP TABLE Reorgs",
        "DROP TABLE UnconfirmedBalances",
        "DROP TABLE ExchangeRates",
        "DROP TABLE StorageProofsInfo"
    ]

    for (var i = 0; i < dropTables.length; i++) {
        console.log("* " + dropTables[i] +"...")
        await SqlAsync.Sql(params, dropTables[i])
    }
    
    console.log("DONE\n")

    setTimeout(function(){
        process.exit()
    }, 3000)
}