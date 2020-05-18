// Database.js - A simple tool for executing manual SQL queries on the database of Navigator-Sia
// Github: https://github.com/hakkane84/navigator-sia
// License: GNU AGPLv3
// Author: Salvador Herrera (keops_cc@outlook.com)

// Usage: type an SQL statement on the command line.
// Example: `node database.js SELECT * FROM BlockInfo WHERE Height=13521`

// For statements including special characters, as parentheses, write the statement on the caraiable bellow
// otherwise, leave it as a null or an empty string
var manualSql = ""

var SqlAsync = require('../modules/sql_async.js')
var fs = require('fs');
var stripJsonComments = require('strip-json-comments')

// Load configuration file
var rawFile = fs.readFileSync("../config.json").toString()
var config = JSON.parse(stripJsonComments(rawFile))

// Loads all the parameters and functions, from the external params.js module
var Params = require('../modules/params.js')
var params = Params.Params(config, "../")


var sqlQuery = ""
for (var i = 2; i < process.argv.length; i++) {
    if (i != 2) {
        sqlQuery = sqlQuery + " "
    } 
    sqlQuery = sqlQuery + process.argv[i]
}

setTimeout(function(){;
    if (manualSql != null && manualSql != "") {
        console.log("Executing a programatically introduced SQL statement:")
        main(manualSql)
    } else {
        main(sqlQuery)
    }
}, 2000)

async function main(sqlQuery) {
    console.log(sqlQuery + ":\n")
    var sqlResult = await SqlAsync.Sql(params, sqlQuery)
    console.log(sqlResult)

    console.log()
    process.exit()
}
