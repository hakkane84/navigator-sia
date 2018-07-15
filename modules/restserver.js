// ===================================
//         RESTful API server
// ===================================

// Parameters for accessing the SQL database (Customize also in navigator.js)
var sqlLogin = {
    server: 'localhost',
    database: 'navigator',
    user: 'xxx', // Introduce SQL user account credentials
    password: 'xxx', // Introduce SQL password
    port: 1433,
    connectionTimeout: 60000,
    requestTimeout: 60000,
    pool: {
        max: 100,
        min: 0,
        idleTimeoutMillis: 30000
    }
}

// Dependencies
var fs = require('fs');
var http = require('http');
var https = require('https');
var express = require('C:/nodejs/node_modules/express');
var bodyParser = require('C:/nodejs/node_modules/body-parser');
var sql = require('C:/nodejs/node_modules/mssql');
var cron = require('C:/nodejs/node_modules/cron');

// SSL keys, INTRODUCE THE FILE NAMES HERE
var privateKey  = fs.readFileSync('./ssl_certificate/xxx.key', 'utf8');
var certificate = fs.readFileSync('./ssl_certificate/xxx.crt', 'utf8');
var credentials = {key: privateKey, cert: certificate};

var app = express();


// STATS initialization
var dayHashCalls = 0
var dayStatusCalls = 0
var hourHashCalls = 0
var hourStatusCalls = 0
var dayBlockedCalls = 0
var hourBlockedCalls = 0
var dayIPrequests = [] // Logs the amount of requests from each IP, to band them if misusing the API
var maxRequestsPerIP = 300 // Threshold for banning an IP for the rest of the day
var IPwhiteList = [
    "::ffff:192.168.1.1" // Local IP
]
var IPblackList = [
    "::ffff:66.249.66.199", // Google bot. Otherwise, it will crawl the whole database at a rate of 30 queries per minute
    "::ffff:66.249.66.201", // Google bot
    "::ffff:66.249.66.203" // Google bot
]


// Routes for the API
// =============================

var router = express.Router(); // get an instance of the express Router

//router.use(bodyParser.urlencoded({extended: false}))
//router.use(bodyParser.json())
router.use(bodyParser.urlencoded({limit: '50mb', extended: true}));
router.use(bodyParser.json({limit: '50mb', extended: true}));

// This prevents CORS issues:
router.use((req,res,next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header(
        "Access-Control-Allow-Headers",
        "Origin, X-Requested-With, Content-Type, Accept, Authorization"
    );
    if (req.method === 'OPTIONS') {
        res.header('Access-Control-Allow-Methods', 'GET', 'POST')
        return res.status(200).json({})
    }
    next();
})

// Middleware to use for all requests
router.use(function(req, res, next) {
    //Loging of calls
    dayHashCalls++
    hourHashCalls++

    var IpIsAllowed = true // By default, all requests are allowed

    // Checking the blacklist
    for (var a = 0; a < IPblackList.length; a++) {
        if (IPblackList[a] == req.connection.remoteAddress) {
            IpIsAllowed = false
        }
    }

    // Checking the IP stats of the day
    var IpMatch = false
    for (var b = 0; b < dayIPrequests.length; b++) {
        if (dayIPrequests[b].ip == req.connection.remoteAddress) {
            IpMatch = true
            if (dayIPrequests[b].count > maxRequestsPerIP) {
                if (IpIsAllowed = false) { // Adds this log line only if it is not an IP already blacklisted
                    console.log("IP blocked for excessive requests: " + req.connection.remoteAddress)
                }
                IpIsAllowed = false
            } else {
                dayIPrequests[b].count++ // Adds to the count of requests
            }
        }
    }
    if (IpMatch == false) { // If not in the database of IPs, add entry
        dayIPrequests.push({ip: req.connection.remoteAddress, count: 1})
    }

    // Checking the whitelist
    for (var c = 0; c < IPwhiteList.length; c++) {
        if (IPwhiteList[c] == req.connection.remoteAddress) {
            IpIsAllowed = true
        }
    }

    if (IpIsAllowed == true) {
        next(); // make sure we go to the next routes and don't stop here
    } else {
        //console.log("IP blocked: " + req.connection.remoteAddress)
        dayBlockedCalls++
        hourBlockedCalls++
        res.json({ message: "You have reached the max daily requests to this API, stablished to avoid unnecesary abuse. If you need unlimited access, just contact siastats@outlook.com and I'll grant it without cost"});
    }
});

// Test route to make sure everything is working (accessed at GET http://localhost:3000/navigator-api)
router.get('/', function(req, res) {
    res.json({ message: "Welcome to the API of of Navigator on SiaStats.info. Check siastats.info/api for documentation"});   
});


// All the requests start requesting a hash type, and depending on it, further SQL queries will be done
// For details about the flow of the queries, check the schematic on the project documentation
// Routes for /hash/:hash_id (accessed at GET http://localhost:3000/navigator-api/hash/:hash_id)
router.route('/hash/:hash_id').get(function(req, res) {
    var initialTime = new Date();

    // Checking the sanity of the request to avoid SQL injections
    var hashReq = sanitySql(req.params.hash_id)

    // connect to your database
    sql.connect(sqlLogin, function (err) {
    
        if (err) console.log(err);

        // create Request object
        var request = new sql.Request();
        
        // query to the database and get the records
        var queryString = "SELECT Type,MasterHash from HashTypes WHERE Hash = '" +  hashReq + "'"
        request.query(queryString, function (err, recordset) {
            sql.close()
            if (err) console.log(err)
            else {
                var hashType
                var resJson = []
                if (recordset.recordset.length != 0) { // Only if something was found in the query
                    var resJson = [recordset.recordset[0]] // Response array to be served
                    var hashType = recordset.recordset[0].Type
                    var masterHash = recordset.recordset[0].MasterHash
                }

                // The following elements of the resJson array will depend on the HashType
                
                if (hashType == "address") { // We retrieve the entries in AddressesChanges
                    sql.connect(sqlLogin, function (err) {
                        if (err) console.log(err);
                        var request = new sql.Request();
                        var queryString = "SELECT DISTINCT MasterHash,ScChange,SfChange,Height,Timestamp,TxType from AddressChanges WHERE Address = '" +  req.params.hash_id + "'"
                        request.query(queryString, function (err, recordset) {
                            sql.close()
                            if (err) console.log(err)
                            else {
                                // 1 - Get balances and number of transactions
                                var txCount = recordset.recordset.length
                                var balanceSc = 0
                                var balanceSf = 0
                                for (var n = 0; n < recordset.recordset.length; n++) {
                                    balanceSc = balanceSc + recordset.recordset[n].ScChange
                                    balanceSf = balanceSf + recordset.recordset[n].SfChange
                                }
                                // Do not send negative balances
                                if (balanceSc < 0) {balanceSc = 0}
                                if (balanceSf < 0) {balanceSf = 0}
                                
                                // 2 - Order by heigt and send only 100 transactions
                                var txs = recordset.recordset
                                txs.sort(function(a,b) {
                                    return parseFloat(b.Height) - parseFloat(a.Height)
                                })
                                var firstSeen = txs[txs.length-1].Height
                                var trimTxs = []
                                for (var m = 0; m < 100 && m < txCount; m++) {
                                    trimTxs.push(txs[m])
                                }
                
                                var addressResponse = {"balanceSc": balanceSc, "balanceSf": balanceSf, "TotalTxCount": txCount, "firstSeen": firstSeen, "last100Transactions": trimTxs}
                                resJson.push(addressResponse)
                                
                                // send records as a response
                                res.send(resJson);

                                // Log
                                timeDelta = new Date() - initialTime
                                console.log("GET: " + req.params.hash_id + " - " + timeDelta + "ms")
                            } 
                        });
                    });
                

                } else if (hashType == "block") { // We retrieve 2- the block metadata first and then the 3- transactions in block
                    sql.connect(sqlLogin, function (err) {
                        if (err) console.log(err);
                        var request = new sql.Request();
                        var queryString = "SELECT * from BlockInfo WHERE Height = " +  masterHash
                        request.query(queryString, function (err, recordset) {
                            sql.close()
                            if (err) console.log(err)
                            else {
                                resJson.push(recordset.recordset[0])
                                
                                // 3- transactions in block
                                sql.connect(sqlLogin, function (err) {
                                    if (err) console.log(err);
                                    var request = new sql.Request();
                                    var queryString = "SELECT TxHash,TxType,TotalAmountSc,TotalAmountSf from BlockTransactions WHERE Height = " +  masterHash
                                    request.query(queryString, function (err, recordset) {
                                        sql.close()
                                        if (err) console.log(err)
                                        else {
                                            resJson.push({"transactions": recordset.recordset})
                                            // send records as a response
                                            res.send(resJson);
                                            
                                            // Log
                                            timeDelta = new Date() - initialTime
                                            console.log("GET: " + req.params.hash_id + " - " + timeDelta + "ms")
                                        } 
                                    });
                                });  
                            } 
                        });
                    });
                

                } else if (hashType == "ScTx" || hashType == "SfTx" || hashType == "storageproof" 
                    || hashType == "blockreward" || hashType == "allowancePost" 
                    || hashType == "collateralPost") { 
                    // We retrieve 2- the TX metadata first and then the 3- Changes in balances of the addresses
                    if (hashType == "blockreward") {masterHash = req.params.hash_id} // These Tx don't have a masterhash
                    sql.connect(sqlLogin, function (err) {
                        if (err) console.log(err);
                        var request = new sql.Request();
                        var queryString = "SELECT HashSynonyms,Height,Timestamp,Fees from TxInfo WHERE TxHash = '" +  masterHash + "'"
                        request.query(queryString, function (err, recordset) {
                            sql.close()
                            if (err) console.log(err)
                            else {
                                resJson.push(recordset.recordset[0])
                                
                                //3- Changes in balances of the addresses
                                sql.connect(sqlLogin, function (err) {
                                    if (err) console.log(err);
                                    var request = new sql.Request();
                                    var queryString = "SELECT DISTINCT Address,ScChange,SfChange,TxType from AddressChanges WHERE MasterHash = '" +  masterHash + "'"
                                    request.query(queryString, function (err, recordset) {
                                        sql.close()
                                        if (err) console.log(err)
                                        else {
                                            resJson.push({"transactions": recordset.recordset})
                                            // send records as a response
                                            res.send(resJson);
                                            
                                            // Log
                                            timeDelta = new Date() - initialTime
                                            console.log("GET: " + req.params.hash_id + " - " + timeDelta + "ms")
                                        } 
                                    });
                                });
                            } 
                        });
                    });
                

                } else if (hashType == "host ann") { // We retrieve 2- the TX metadata first and then the 3- Changes in balances of the addresses
                    sql.connect(sqlLogin, function (err) {
                        if (err) console.log(err);
                        var request = new sql.Request();
                        var queryString = "SELECT HashSynonyms,Height,Timestamp,Fees,IP from HostAnnInfo WHERE TxHash = '" +  masterHash + "'"
                        request.query(queryString, function (err, recordset) {
                            sql.close()
                            if (err) console.log(err)
                            else {
                                resJson.push(recordset.recordset[0])
                                
                                //3- Changes in balances of the addresses
                                sql.connect(sqlLogin, function (err) {
                                    if (err) console.log(err);
                                    var request = new sql.Request();
                                    var queryString = "SELECT DISTINCT Address,ScChange,SfChange from AddressChanges WHERE MasterHash = '" +  masterHash + "'"
                                    request.query(queryString, function (err, recordset) {
                                        sql.close()
                                        if (err) console.log(err)
                                        else {
                                            resJson.push({"transactions": recordset.recordset})
                                            // send records as a response
                                            res.send(resJson);

                                            // Log
                                            timeDelta = new Date() - initialTime
                                            console.log("GET: " + req.params.hash_id + " - " + timeDelta + "ms")
                                        } 
                                    });
                                });
                            } 
                        });
                    });


                } else if (hashType == "contract") { // We retrieve 2- Contract metadata, 3- Revisons related, 4- Contract resolutions 5 - Storage proofs
                    sql.connect(sqlLogin, function (err) {
                        if (err) console.log(err);
                        var request = new sql.Request();
                        var queryString = "SELECT * from ContractInfo WHERE MasterHash = '" +  masterHash + "'"
                        request.query(queryString, function (err, recordset) {
                            sql.close()
                            if (err) console.log(err)
                            else {
                                resJson.push(recordset.recordset[0])
                                if (recordset.recordset.length >= 1) { // This check avoids crashes of the server. Apparently, some contracts are missing information
                                    if (recordset.recordset[0].ContractId != null) { // Sanity check
                                        var contractId = recordset.recordset[0].ContractId
                                        
                                        //3- Revisons related
                                        sql.connect(sqlLogin, function (err) {
                                            if (err) console.log(err);
                                            var request = new sql.Request();
                                            var queryString = "SELECT * from RevisionsInfo WHERE ContractId = '" +  contractId + "'"
                                            request.query(queryString, function (err, recordset) {
                                                sql.close()
                                                if (err) console.log(err)
                                                else {
                                                    if (recordset.recordset.length != 0) {
                                                        resJson.push(recordset.recordset[0])
                                                    } else {
                                                        resJson.push({})
                                                    }
                                                    
                                                    //4- Contract resolutions
                                                    sql.connect(sqlLogin, function (err) {
                                                        if (err) console.log(err);
                                                        var request = new sql.Request();
                                                        var queryString = "SELECT * from ContractResolutions WHERE ContractId = '" + contractId + "'"
                                                        request.query(queryString, function (err, recordset) {
                                                            sql.close()
                                                            if (err) console.log(err)
                                                            else {
                                                                if (recordset.recordset.length != 0) {
                                                                    resJson.push(recordset.recordset[0])
                                                                    proofPostingHash = recordset.recordset[0].ProofPostingHash
                                                                    
                                                                    if (proofPostingHash != null) {
                                                                        //5- Proof of storage
                                                                        sql.connect(sqlLogin, function (err) {
                                                                            if (err) console.log(err);
                                                                            var request = new sql.Request();
                                                                            var queryString = "SELECT * from TxInfo WHERE TxHash = '" +  proofPostingHash + "'"
                                                                            request.query(queryString, function (err, recordset) {
                                                                                sql.close()
                                                                                if (err) console.log(err)
                                                                                else {
                                                                                    if (recordset.recordset.length != 0) {
                                                                                        resJson.push(recordset.recordset[0])
                                                                                    } else {
                                                                                        resJson.push({})
                                                                                    }
                                                                                    // send records as a response
                                                                                    res.send(resJson);

                                                                                    // Log
                                                                                    timeDelta = new Date() - initialTime
                                                                                    console.log("GET: " + req.params.hash_id + " - " + timeDelta + "ms")
                                                                                } 
                                                                            });
                                                                        });
                                                                    } else {
                                                                        // If there is no Proof of storage associated, push an empty element and return response
                                                                        resJson.push({})
                                                                        res.send(resJson);

                                                                        // Log
                                                                        timeDelta = new Date() - initialTime
                                                                        console.log("GET: " + req.params.hash_id + " - " + timeDelta + "ms")
                                                                    }
                                                                } else {
                                                                    resJson.push({})
                                                                    resJson.push({}) // Adding also an empty storage proof

                                                                    // send records as a response
                                                                    res.send(resJson);

                                                                    // Log
                                                                    timeDelta = new Date() - initialTime
                                                                    console.log("GET: " + req.params.hash_id + " - " + timeDelta + "ms")
                                                                }
                                                            } 
                                                        });
                                                    });
                                                } 
                                            });
                                        });
                                    } else { // The contract was not found on the database, return an empty array
                                        resJson = []
                                        res.send(resJson);

                                        // Log
                                        timeDelta = new Date() - initialTime
                                        console.log("GET: " + req.params.hash_id + " - " + timeDelta + "ms")
                                    }
                                }
                            } 
                        });
                    });


                } else if (hashType == "revision") { // We retrieve 2- the Revision metadata first and then the 3- Changes in balances of the addresses
                    sql.connect(sqlLogin, function (err) {
                        if (err) console.log(err);
                        var request = new sql.Request();
                        var queryString = "SELECT * from RevisionsInfo WHERE MasterHash = '" +  masterHash + "'"
                        request.query(queryString, function (err, recordset) {
                            sql.close()
                            if (err) console.log(err)
                            else {
                                resJson.push(recordset.recordset[0])
                                
                                //3- Changes in balances of the addresses
                                sql.connect(sqlLogin, function (err) {
                                    if (err) console.log(err);
                                    var request = new sql.Request();
                                    var queryString = "SELECT DISTINCT Address,ScChange,SfChange from AddressChanges WHERE MasterHash = '" +  masterHash + "'"
                                    request.query(queryString, function (err, recordset) {
                                        sql.close()
                                        if (err) console.log(err)
                                        else {
                                            resJson.push({"transactions": recordset.recordset})
                                            // send records as a response
                                            res.send(resJson);

                                            // Log
                                            timeDelta = new Date() - initialTime
                                            console.log("GET: " + req.params.hash_id + " - " + timeDelta + "ms")
                                        } 
                                    });
                                });
                            } 
                        });
                    });


                } else if (hashType == "contractresol") { // We retrieve 2- the Revision metadata first and then the 3- Changes in balances of the addresses
                    sql.connect(sqlLogin, function (err) {
                        if (err) console.log(err);
                        var request = new sql.Request();
                        var queryString = "SELECT * from ContractResolutions WHERE MasterHash = '" +  masterHash + "'"
                        request.query(queryString, function (err, recordset) {
                            sql.close()
                            if (err) console.log(err)
                            else {
                                resJson.push(recordset.recordset[0])
                                
                                //3- Changes in balances of the addresses
                                sql.connect(sqlLogin, function (err) {
                                    if (err) console.log(err);
                                    var request = new sql.Request();
                                    var queryString = "SELECT DISTINCT Address,ScChange,SfChange from AddressChanges WHERE MasterHash = '" +  masterHash + "'"
                                    request.query(queryString, function (err, recordset) {
                                        sql.close()
                                        if (err) console.log(err)
                                        else {
                                            resJson.push({"transactions": recordset.recordset})
                                            // send records as a response
                                            res.send(resJson);

                                            // Log
                                            timeDelta = new Date() - initialTime
                                            console.log("GET: " + req.params.hash_id + " - " + timeDelta + "ms")
                                        } 
                                    });
                                });
                            } 
                        });
                    });

                
                } else { // Sending an empty response
                    res.send(resJson);

                    // Log
                    timeDelta = new Date() - initialTime
                    console.log("GET: " + req.params.hash_id + " - " + timeDelta + "ms")
                }

            } 
        });
    });
});

// BATCH SEARCH ROUTES HERE AND OTHERS

// Checks a batch of addresses (accessed at POST http://localhost:3500/api/addresses)
router.route('/addresses')
.post(function(req, res) {
    var initialTime = new Date();
    var addresses = req.body.query;
    var page = parseInt(req.body.page)
    if (page > 0) {} else {
        page = 1 // Defaulting to page 1 in case of malformed POST requests
    }

    // Splits the string into an array of addresses
    addressesArray = addresses.match(/[^\r\n]+/g)
    
    // Limit to 5000 addresses here
    addressesArray = addressesArray.splice(0,1000)

    hash = sanitySql(addressesArray[0])
    sqlQuery = "Address = '" + hash + "' "
    for (var n = 1; n < addressesArray.length; n++) {
        hash = sanitySql(addressesArray[n])
        if (hash != "") {
            sqlQuery = sqlQuery + "OR Address = '" + addressesArray[n] + "' "
        }
    }
    //console.log(sqlQuery)

    // SQL request
    sql.connect(sqlLogin, function (err) {
        if (err) console.log(err);
        var request = new sql.Request();
        var queryString = "SELECT DISTINCT Address,MasterHash,ScChange,SfChange,Height,Timestamp,TxType from AddressChanges WHERE " +  sqlQuery
        request.query(queryString, function (err, recordset) {
            sql.close()
            if (err) console.log(err)
            else {
                // 1 - Total balance of the batch
                var balanceSc = 0
                var balanceSf = 0
                for (var n = 0; n < recordset.recordset.length; n++) {
                    balanceSc = balanceSc + recordset.recordset[n].ScChange
                    balanceSf = balanceSf + recordset.recordset[n].SfChange
                }
                // Do not send negative balances
                if (balanceSc < 0) {balanceSc = 0}
                if (balanceSf < 0) {balanceSf = 0}

                // 2 - Balance of each address
                var addressesBalance = []
                for (var n = 0; n < addressesArray.length; n++) { // For each address
                    var addressSc = 0
                    var addressSf = 0
                    for (var m = 0; m < recordset.recordset.length; m++) { // For each result
                        if (recordset.recordset[m].Address == addressesArray[n]) {
                            addressSc = addressSc + recordset.recordset[m].ScChange
                            addressSf = addressSf + recordset.recordset[m].SfChange
                        }
                    }
                    addressesBalance.push({"address": addressesArray[n], "sc": addressSc, "sf": addressSf})
                }

                // 3 - Merging changes of internal transactions
                var txs = recordset.recordset
                var newTxs = []
                for (var n = 0; n < txs.length; n++) { // For each tx
                    var matchBool = false
                    for (var m = 0; m < newTxs.length; m++) { // Check it is not already in the newTxs
                        if (txs[n].MasterHash == newTxs[m].MasterHash) {
                            matchBool = true
                            newTxs[m].ScChange = newTxs[m].ScChange + txs[n].ScChange
                            newTxs[m].SfChange = newTxs[m].SfChange + txs[n].SfChange
                        }
                    }
                    if (matchBool == false) { // If not already in newTxs, push it
                        newTxs.push(txs[n])
                    }  
                }

                var txCount = newTxs.length
                
                // 4 - Order by heigt and send only 100 transactions, according to the page
                newTxs.sort(function(a,b) {
                    return parseFloat(b.Height) - parseFloat(a.Height)
                })
                var trimTxs = []

                for (var m = ((page * 100) - 100); m < (page * 100) && m < txCount; m++) {
                    trimTxs.push(newTxs[m])
                }

                // Constructing JSON response
                var addressResponse = []
                addressResponse.push({"balanceSc": balanceSc, "balanceSf": balanceSf, "TotalTxCount": txCount, "page": page})
                addressResponse.push({"addresses": addressesBalance})
                addressResponse.push({"last100Transactions": trimTxs})
                
                // send records as a response
                res.json(addressResponse);

                // Log
                timeDelta = new Date() - initialTime
                console.log("Batch of addresses queried: " + addressesArray.length + " - " + timeDelta + "ms")
            } 
        });
    });
});

// Checks a processed file of host contracts (accessed at POST http://localhost:3500/navigator-api/host-contracts)
router.route('/host-contracts')
.post(function(req, res) {
    var initialTime = new Date();
    var file = req.body.query;  
    
    var processedArray = preprocessHostFile(file)
    // Limit to 1000 contracts here
    contractsArray = processedArray.splice(0,1000)

    console.log("Batch of contracts queried: " + contractsArray.length)
    
    hash = sanitySql(contractsArray[0])
    sqlQuery = "ContractId = '" + hash.contractId + "' "
    for (var n = 1; n < contractsArray.length; n++) {
        hash = sanitySql(contractsArray[n])
        if (hash != "") {
            sqlQuery = sqlQuery + "OR ContractId = '" + hash.contractId + "' "
        }
    }
    // SQL request
    sql.connect(sqlLogin, function (err) {
        if (err) console.log(err);
        var request = new sql.Request();
        var queryString = "SELECT * from ContractInfo WHERE " +  sqlQuery
        request.query(queryString, function (err, recordset) {
            sql.close()
            if (err) console.log(err)
            else {
                recordset.recordset.sort(function(a,b) {
                    return parseFloat(a.Height) - parseFloat(b.Height)
                })
                
                // 1 - Matching SQL results with the array we have
                var revenueGain = 0
                var revenueLost = 0
                var revenueNet = 0
                var countSuccess = 0
                var countFail = 0
                var countUnused = 0
                var countOngoing = 0
                var contractsNotFound = []
                if (recordset.recordset.length > 0) { // To avoid crashes on malformed requests, only if there is something to analyze
                    for (var i = 0; i < contractsArray.length; i++) {
                        var matchBool = false
                        for (var j = 0; j < recordset.recordset.length; j++) {
                            if (contractsArray[i].contractId != null) { // Avoids malformed crashes due to malformed reports without contractIDs
                                if (recordset.recordset[j].ContractId == contractsArray[i].contractId) {
                                    matchBool = true
                                    // Match! Adding data
                                    contractsArray[i].duration = recordset.recordset[j].WindowEnd - recordset.recordset[j].Height
                                    contractsArray[i].timestamp = recordset.recordset[j].Timestamp
                                    contractsArray[i].filesize = recordset.recordset[j].CurrentFileSize
                                    if (recordset.recordset[j].Status == 'complete-fail' && parseInt(recordset.recordset[j].MissedProof3Value) == 0) {
                                        contractsArray[i].statusnavigator = "unused" // Rename to unused to those failed without penalty, as they are actually not the fault of the host
                                    } else {
                                        contractsArray[i].statusnavigator = recordset.recordset[j].Status
                                    }
                                    if (contractsArray[i].statusnavigator == "complete-fail") {
                                        revenueLost = revenueLost + recordset.recordset[j].MissedProof3Value
                                        revenueNet = revenueNet - recordset.recordset[j].MissedProof3Value
                                        countFail++
                                    } else if (contractsArray[i].statusnavigator == "complete-succ") {
                                        // The amount sent as collateral is substracted
                                        revenueGain = revenueGain + recordset.recordset[j].ValidProof2Value - recordset.recordset[j].HostValue
                                        revenueNet = revenueNet + recordset.recordset[j].ValidProof2Value - recordset.recordset[j].HostValue
                                        countSuccess++
                                    } else if (contractsArray[i].statusnavigator == "unused") {
                                        // The difference between the collateral and the returned amount (the contract fees) is added
                                        countUnused++
                                        revenueGain = revenueGain + recordset.recordset[j].ValidProof2Value - recordset.recordset[j].HostValue
                                        revenueNet = revenueNet + recordset.recordset[j].ValidProof2Value - recordset.recordset[j].HostValue
                                    } else if (contractsArray[i].statusnavigator == "ongoing") {
                                        countOngoing++
                                    }
                                }
                            }
                        }
                        // Reports bad contracts not existing on the blockchain
                        if (matchBool ==false) {
                            //console.log(contractsArray[i].contractId)
                            contractsNotFound.push(contractsArray[i].contractId)
                        }
                    }
                }

                // Splicing contracts not found on Navigator
                for (var i = 0; i < contractsArray.length; i++) {
                    if (contractsArray[i].statusnavigator == null) {
                        contractsArray.splice(i,1)
                        i--
                    }
                }

                // Constructing JSON response
                var contractsResponse = []
                contractsResponse.push({"countsuccess": countSuccess, "countfail": countFail, "countunused": countUnused, "countongoing": countOngoing,
                    "revenuegain": revenueGain, "revenuelost": revenueLost, "revenuenet": revenueNet})
                contractsResponse.push({"contracts": contractsArray})
                contractsResponse.push({"contractsNotFound": contractsNotFound})
                
                // Send records as a response
                res.json(contractsResponse);

                // Log
                timeDelta = new Date() - initialTime
                console.log("Contracts batch retrieved: " + recordset.recordset.length + " - " + timeDelta + "ms")
            } 
        });
    });
});

// Status request: returns the current highest block in the blockchain, in the database and the timestamp of the last check
router.get('/status', function(req, res) {
    // Logging activity
    dayStatusCalls++
    hourStatusCalls++

    // Reads the file status.json
    var data = '';
    var chunk;
    var stream = fs.createReadStream("../status.json")
    stream.on('readable', function() { //Function just to read the whole file before proceeding
        while ((chunk=stream.read()) != null) {
            data += chunk;}
    });
    stream.on('end', function() {
        if (data != "") {var statusResponse = JSON.parse(data)
        } else {var statusResponse = []} // Empty array
        res.json(statusResponse);
    }); 
});

// Landing page stats: returns the last 10 TX of each kind and the distribution of the last 10 000 transactions of the network
router.get('/landing', function(req, res) {
    // Reads the file landingpagedata.json
    var data = '';
    var chunk;
    var stream = fs.createReadStream("../landingpagedata.json")
    stream.on('readable', function() { //Function just to read the whole file before proceeding
        while ((chunk=stream.read()) != null) {
            data += chunk;}
    });
    stream.on('end', function() {
        if (data != "") {var statusResponse = JSON.parse(data)
        } else {var statusResponse = []} // Empty array
        res.json(statusResponse);
    }); 
});


// All the routes will be prefixed with /navigator-api
app.use('/navigator-api', router);

// your express configuration here

var httpServer = http.createServer(app);
var httpsServer = https.createServer(credentials, app);

port = 3500
httpsServer.listen(port);

console.log("----------------------------------------------")
console.log('+ Navigator API server running on port: ' + port + " +") 
console.log("----------------------------------------------")


var cronJob = cron.job("00 00 * * * *", function(){
    // Hour statistics of usage
    var hourAPIcalls = hourHashCalls - hourStatusCalls - hourBlockedCalls
    console.log("")
    console.log("+++ Usage in the last hour: " + hourAPIcalls + " API calls, " + hourStatusCalls + " web calls +++")
    console.log("")

    hourHashCalls = 0
    hourStatusCalls = 0
    hourBlockedCalls = 0
})
cronJob.start();

var cronJob2 = cron.job("10 00 00 * * *", function(){
    // Daily statistics of usage
    var dayAPIcalls = dayHashCalls - dayStatusCalls - dayBlockedCalls
    console.log()
    console.log("----------------------------------------------------------------------------")
    console.log("+++                     NAVIGATOR DAILY USAGE REPORT                     +++")
    console.log("+++ Usage in the last 24h: " + dayAPIcalls + " API calls, " + dayStatusCalls + " web calls +++")
    console.log("----------------------------------------------------------------------------")
    console.log("+++ Users:")
    for (var d = 0; d < dayIPrequests.length; d++) {
        console.log(dayIPrequests[d].ip + " --> " + dayIPrequests[d].count + " calls")
    }
    console.log("----------------------------------------------------------------------------")

    dayHashCalls = 0
    dayStatusCalls = 0
    dayBlockedCalls = 0
    dayIPrequests = [] // Resets the list of IP requests
})
cronJob2.start();



function preprocessHostFile(file) {
    // Splits the string into an array of addresses
    fileArray = file.match(/[^\r\n]+/g)
    processedArray = []

    // Iterates each row and parses it into an array
    for (var n = 1; n < fileArray.length; n++) { // Skips the first line, with the column names
        var contractId = fileArray[n].slice(0,64)
        var status = fileArray[n].slice(68,78)
        var locked = fileArray[n].slice(106,114)
        var risked = fileArray[n].slice(127,135)
        var revenue = fileArray[n].slice(148,156)
        contractId = sanitySql(contractId)
        if (contractId != "") {
            processedArray.push({"contractId": contractId, "status": status, "locked": locked, "risked": risked, "revenue": revenue})
        }
    }

    return processedArray
}

function sanitySql(hash) {
    // This function checks that the introduced string by the user is actually an hexadecimal string (or includes the "R" of revision)
    // This avoids SQL injection attacks

    sanityOk = true
    //console.log("Checking: " + hash)
    // Checks each character of the string, looking for abnormal characters. I only accept hexadecimals (upper and lowercase) and R/r
    for (var n = 1; n < hash.length; n++) {
        s = hash.slice(n, (n+1))
        if (s != "0" && s != "1" && s != "2" && s != "3" && s != "4" && s != "5" && s != "6" && s != "7" && s != "8" && s != "9" && 
            s != "a" && s != "A" && s != "b" && s != "B" && s != "c" && s != "C" && s != "d" && s != "D" && s != "e" && s != "E" && 
            s != "f" && s != "F" && s != "r" && s != "R") {
                //console.log("Insanity in " + hash + ": " + s)
                sanityOk = false
            }
    }
    if (sanityOk == false) {
        hash = ""
    }
    
    return hash
}
