var fs = require('fs');
var sql = require('C:/nodejs/node_modules/mssql');

var poolsFilePath = "../poolAddresses.json"

// Parameters for accessing the SQL database
var sqlLogin = { 
    server: 'localhost',
    database: 'navigator2',
    user: 'keops',
    password: 'Fulgor2740',
    port: 1433,
    connectionTimeout: 600000,
    requestTimeout: 600000,
    pool: {
        max: 100,
        min: 0,
        idleTimeoutMillis: 30000
    }
}

// We open the poolsAddresses database
var data1 = '';
var chunk1;
var stream1 = fs.createReadStream(poolsFilePath)
stream1.on('readable', function() { //Function just to read the whole file before proceeding
    while ((chunk1=stream1.read()) != null) {
        data1 += chunk1;}
});
stream1.on('end', function() {
    if (data1 != "") {
        var poolsDb = JSON.parse(data1)
    } else {
        var poolsDb = [] // Empty array
    }
    console.log("-----------------------------")
    console.log("Pools addresses database open")
    console.log("-----------------------------")
    console.log()

    var poolNum = 0
    var addressNum = 0
    initial(poolsDb, poolNum, addressNum)
})

function iterator(poolsDb, poolNum, addressNum) {
    // This function gets repeated for each address of each pool, to update the entries of the SQL database

    var query = "UPDATE BlockInfo SET MiningPool = '" + poolsDb[poolNum].name + "' WHERE MinerPayoutAddress = '" + poolsDb[poolNum].addresses[addressNum] + "'"

    var dbConn = new sql.ConnectionPool(sqlLogin);
    dbConn.connect().then(function () {
        var request = new sql.Request(dbConn);
        request.query(query).then(function (recordSet) {
            dbConn.close();

            console.log("Address: " + poolsDb[poolNum].addresses[addressNum] + " updated")
            addressNum++

            // Next pool if we are done
            if (addressNum >= poolsDb[poolNum].addresses.length) {
                addressNum = 0
                poolNum++
                // Only if it was not the last pool
                if (poolNum < poolsDb.length) {
                    // Next
                    console.log()
                    console.log("+++++ POOL: " + poolsDb[poolNum].name + " +++++")
                    iterator(poolsDb, poolNum, addressNum)
                } else {
                    finish()
                }
            } else {
                // Next
                iterator(poolsDb, poolNum, addressNum)
            }

        }).catch(function (err) {
            console.log(err);
            dbConn.close();
        });
    }).catch(function (err) {});
}


function initial(poolsDb, poolNum, addressNum) {
    // All are setup as Unknown by default

    console.log()
    console.log("+++++ UNKNOWN BLOCKS +++++")
    console.log()

    var query = "UPDATE BlockInfo SET MiningPool = 'Unknown'"
    var dbConn = new sql.ConnectionPool(sqlLogin);
    dbConn.connect().then(function () {
        var request = new sql.Request(dbConn);
        request.query(query).then(function (recordSet) {
            dbConn.close();

            // Starts the iterator
            console.log("+++++ POOL: " + poolsDb[0].name + " +++++")
            iterator(poolsDb, poolNum, addressNum)

        }).catch(function (err) {
            console.log(err);
            dbConn.close();
        });
    }).catch(function (err) {});
}


function finish() {
    console.log()
    console.log("DONE")
    console.log()
}