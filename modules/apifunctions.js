// Functions executed by the API RESTfuk server (restserver.js)
var exports = module.exports={}
var jsonexport = require('jsonexport')
var qrcode = require('qrcode')
var fs = require('fs');
var SqlAsync = require('./sql_async.js')
var SqlComposer = require('./sql_composer.js')
var Commons = require('./commons.js')

// ========================
// Functions for API routes
// ========================

// Search by hash
exports.Hash = async function(params, res, req) {
    var initialTime = new Date();

    // Checking the sanity of the request to avoid SQL injections
    var hashReq = sanitySql(req.params.hash_id)
    var resJson = [] // The JSON we will return. Initialize empty array

    // A - Hash type: depending on the object, the next queries will difer
    var sqlQuery = "SELECT Type,Masterhash FROM HashTypes WHERE Hash = '" +  hashReq + "'"
    var recordset = await SqlAsync.Sql(params, sqlQuery)
    var hashType 
    if (recordset.length != 0) { // Only if something was found in the query
        
        var hashType = recordset[0].Type
        var masterHash = recordset[0].Masterhash
        if (masterHash == "" || masterHash == null 
            || masterHash == "                                                                            ") {
            masterHash = hashReq
        }
        var resJson = [{
            "Type": hashType,
            "MasterHash": masterHash // Keeps compatibility (uppercase "H")
        }] 
    }

    // ADDRESS
    if (hashType == "address") { 
        // B1 - Next search: AddressesChanges
        var sqlQuery = "SELECT DISTINCT MasterHash,ScChange,SfChange,Height,Timestamp,TxType FROM AddressChanges WHERE Address = '" +  hashReq + "'"
        var recordset = await SqlAsync.Sql(params, sqlQuery)
        
        // Balances, sent/received amounts and number of transactions
        var txCount = recordset.length
        var balanceSc = 0
        var balanceSf = 0
        var sentSc = 0
        var receivedSc = 0
        for (var n = 0; n < recordset.length; n++) {
            balanceSc = balanceSc + recordset[n].ScChange
            balanceSf = balanceSf + recordset[n].SfChange
            if (recordset[n].ScChange > 0) {
                receivedSc = receivedSc + recordset[n].ScChange
            } else if (recordset[n].ScChange < 0) {
                sentSc = sentSc + (recordset[n].ScChange * -1)
            }
        }
        // Do not send negative balances
        if (balanceSc < 0) {balanceSc = 0}
        if (balanceSf < 0) {balanceSf = 0}

        // Order by heigt and send only 100 transactions
        var txs = recordset
        txs.sort(function(a,b) {
            return parseFloat(b.Height) - parseFloat(a.Height)
        })
        var firstSeen = txs[txs.length-1].Height
        var trimTxs = []
        for (var m = 0; m < 100 && m < txCount; m++) {
            trimTxs.push(txs[m])
        }

        // Unconfirmed transactions
        var sqlQuery = "SELECT ScValue,SfValue,TxType,Timestamp FROM UnconfirmedBalances WHERE Address = '" + hashReq + "'"
        var recordsetUnconfirmed = await SqlAsync.Sql(params, sqlQuery)
        var pendingSc = 0
        var pendingSf = 0
        for (var i = 0; i < recordsetUnconfirmed.length; i++) {
            pendingSc = pendingSc + recordsetUnconfirmed[i].ScValue
            pendingSf = pendingSf + recordsetUnconfirmed[i].SfValue
        }

        // Add to response
        var addressResponse = {
            "balanceSc": balanceSc,
            "receivedSc": receivedSc,
            "sentSc": sentSc,
            "balanceSf": balanceSf, 
            "TotalTxCount": txCount, 
            "firstSeen": firstSeen, 
            "last100Transactions": trimTxs,
            "pendingSc": pendingSc,
            "pendingSf": pendingSf,
            "unconfirmedTransactions": recordsetUnconfirmed
        }
        resJson.push(addressResponse)
    
    // OUTPUT
    } else if (hashType == "output") { 
        // C1 - Next search: Outputs
        var sqlQuery = "SELECT * FROM Outputs WHERE OutputId = '" +  hashReq + "'"
        var recordset = await SqlAsync.Sql(params, sqlQuery)
        if (recordset.length != 0) {
            resJson.push(recordset[0])
        }

    // BLOCK
    } else if (hashType == "block") { 
        // D1 - Next search: Block Metadata
        var sqlQuery = "SELECT * from BlockInfo WHERE Height = " +  masterHash
        var recordset = await SqlAsync.Sql(params, sqlQuery)
        if (recordset.length != 0) {
            resJson.push(recordset[0])
        } else {
            resJson.push({})
        }

        // D2 - Next search: Transactions in block
        var sqlQuery = "SELECT TxHash,TxType,TotalAmountSc,TotalAmountSf from BlockTransactions WHERE Height = " +  masterHash
        var recordset = await SqlAsync.Sql(params, sqlQuery)
        resJson.push({"transactions": recordset})

    // SIMPLE TRANSACTIONS
    } else if (hashType == "ScTx" || hashType == "SfTx" || hashType == "blockreward" || hashType == "allowancePost" 
        || hashType == "collateralPost") {
        
        // Some TX don't have masterHash, default instead to the user request
        if (masterHash == null || masterHash == "") {masterHash = req.params.hash_id}
        
        // D1 - Next search: Transaction info
        var sqlQuery = "SELECT HashSynonyms,Height,Timestamp,Fees from TxInfo WHERE TxHash = '" +  masterHash + "'"
        var recordset = await SqlAsync.Sql(params, sqlQuery)
        if (recordset.length != 0) {
            resJson.push(recordset[0])
        } else {
            resJson.push({})
        }

        // D2 - Next search: Changes in balance
        var sqlQuery = "SELECT DISTINCT Address,ScChange,SfChange,TxType from AddressChanges WHERE MasterHash = '" +  masterHash + "'"
        var recordset = await SqlAsync.Sql(params, sqlQuery)
        
        // We need to discard the negative changes that are related to contract formations (allowanceposting and collateralposting),
        // as concatenated transactions with contracts can create weird display bugs on the amounts scheme (an intermediate address than is later
        // used for collateral // allowance posting)
        if (hashType == "ScTx" || hashType == "SfTx") {
            for (var i = 0; i < recordset.length; i++) {
                if ((recordset[i].TxType == 'allowancePost' || recordset[i].TxType == 'collateralPost') && recordset[i].ScChange < 0) {
                    recordset.splice(i,1)
                    i--
                }
            } 
        }
        resJson.push({"transactions": recordset})

    // HOST ANNOUNCEMENTS
    } else if (hashType == "host ann") {
        // E1 - Next search: Host ann metadata
        var sqlQuery = "SELECT HashSynonyms,Height,Timestamp,Fees,IP from HostAnnInfo WHERE TxHash = '" +  masterHash + "'"
        var recordset = await SqlAsync.Sql(params, sqlQuery)
        if (recordset.length != 0) {
            resJson.push(recordset[0])
        } else {
            resJson.push({})
        }

        // E1 - Next search: Addresses changes
        var sqlQuery = "SELECT DISTINCT Address,ScChange,SfChange from AddressChanges WHERE MasterHash = '" +  masterHash + "'"
        var recordset = await SqlAsync.Sql(params, sqlQuery)
        resJson.push({"transactions": recordset})

    // CONTRACTS
    } else if (hashType == "contract") {
        // F1 - Next search: Contract metadata
        var sqlQuery = "SELECT * from ContractInfo WHERE MasterHash = '" +  masterHash + "' OR ContractId = '" + hashReq + "'" 
        var recordset = await SqlAsync.Sql(params, sqlQuery)
        if (recordset.length != 0) {
            // As in SQL Server the INT type is 4 bytes, we correct the revision number to max uint64
            if (recordset[0].RevisionNum >= 2147483647) {
                recordset[0].RevisionNum = 18446744073709551616
            }
            // Adding the computed SF fees
            recordset[0].SfFees = (recordset[0].ValidProof1Value + recordset[0].ValidProof2Value) * params.blockchain.siafundFees
            resJson.push(recordset[0])
        } else {
            resJson.push({})
        }

        if (recordset.length > 0) { // Sanity check
            var contractId = recordset[0].ContractId

            // F2 - Next search: Revisions
            var sqlQuery = "SELECT * from RevisionsInfo WHERE ContractId = '" +  contractId + "'"
            var recordset = await SqlAsync.Sql(params, sqlQuery)
            if (recordset.length != 0) {
                // As in SQL Server the INT type is 4 bytes, we correct the revision number to max uint64
                if (recordset[0].NewRevisionNum >= 2147483647) {
                    recordset[0].NewRevisionNum = 18446744073709551616
                }
                resJson.push(recordset[0])
            } else {
                resJson.push({})
            }

            // F3 - Next search: Contract resolutions
            var sqlQuery = "SELECT * from ContractResolutions WHERE ContractId = '" + contractId + "'"
            var recordset = await SqlAsync.Sql(params, sqlQuery)
            if (recordset.length != 0) {
                resJson.push(recordset[0])
            } else {
                resJson.push({})
            }

            // F4 - Next search: Storage proofs
            var sqlQuery = "SELECT * from StorageProofsInfo WHERE ContractId = '" + contractId + "'"
            var recordset = await SqlAsync.Sql(params, sqlQuery)
            if (recordset.length != 0) {
                resJson.push(recordset[0])
            } else {
                resJson.push({})
            }

            // F5 - Next search: Additional outputs created during the contract formation. They return to the renter
            // `us` library contracts can do this
            var sqlQuery = "SELECT Address,ScChange FROM AddressChanges WHERE MasterHash = '" + masterHash + "' AND ScChange > 0"
            var recordset = await SqlAsync.Sql(params, sqlQuery)
            if (recordset.length != 0) {
                resJson.push({transactions: recordset})
            } else {
                resJson.push({transactions: []})
            }
        }

    // REVISIONS, RESOLUTIONS AND STORAGE PROOFS
    } else if (hashType == "revision" || hashType == "storageproof" || hashType == "contractresol") {
        // G1 - Next search: Info. The queried table depends on the type
        if (hashType == "revision") {
            var sqlQuery = "SELECT * from RevisionsInfo WHERE MasterHash = '" +  masterHash + "'"
        } else if (hashType == "storageproof") {
            var sqlQuery = "SELECT * from StorageProofsInfo WHERE MasterHash = '" +  masterHash + "'"
        } else {
            var sqlQuery = "SELECT * from ContractResolutions WHERE MasterHash = '" +  masterHash + "'"
        }
        var recordset = await SqlAsync.Sql(params, sqlQuery)
        if (recordset.length != 0) {
            // As in SQL Server the INT type is 4 bytes, we correct the revision number to max uint64
            if (hashType == "revision") {
                if (recordset[0].NewRevisionNum >= 2147483647) {
                    recordset[0].NewRevisionNum = 18446744073709551616
                }
            }
            resJson.push(recordset[0])
        } else {
            resJson.push({})
        }

        // G2 -  Next search: Changes in addresses
        var sqlQuery = "SELECT DISTINCT Address,ScChange,SfChange from AddressChanges WHERE MasterHash = '" +  masterHash + "'"
        var recordset = await SqlAsync.Sql(params, sqlQuery)
        resJson.push({"transactions": recordset})
    
    // MALFORMED REQUEST
    } else if (hashReq == null) {
        // Nothing

    // MEMPOOL IF NOTHING WAS FOUND
    } else {
        // Only if the hash is 64 or 76 characters long
        if (hashReq.length == 64) {
            // Check the mempool for unconfirmed TX
            resJson = await searchMempool(params, hashReq, resJson)
        
        } else if (hashReq.length == 76) {
            // Unconfirmed addresses
            resJson = await searchUnconfirmed(params, hashReq, resJson)
        }
    }

    // X - API response and logging
    res.send(resJson);
    if (params.verboseApiLogs == true) {
        timeDelta = new Date() - initialTime
        console.log("GET: " + req.params.hash_id + " - " + timeDelta + "ms")
    }
}


// Unspent outputs of a given address
exports.UnspentOutputs = async function(params, res, req) {
    var initialTime = new Date();
    
    // Checking the sanity of the request to avoid SQL injections
    var hash = sanitySql(req.params.hash_id)

    if (hash == "" || hash.length != 76
        || hash == "000000000000000000000000000000000000000000000000000000000000000089eb0d6a8a69" ) {
        // Bad request, or the burning address (unnecesary tedious search that could be used for an attack), or bad length
        res.status(400).send('Wrong hash format')
    
    } else {
        // Database search
        var sqlQuery = "SELECT DISTINCT OutputId, ScValue, SfValue from Outputs WHERE Address = '" +  hash + "' AND Spent IS null"
        var recordset = await SqlAsync.Sql(params, sqlQuery)

        // Making an API compatible with my old API that queried the explorer module
        var resJson = []
        for (var i = 0; i < recordset.length; i++) {
            if (recordset[i].ScValue != null) { // Avoid scientific notation to give full precision
                var hastings = recordset[i].ScValue.toLocaleString('fullwide', {useGrouping:false})
            } else {
                var hastings = recordset[i].ScValue
            }
            resJson.push({
                "output": recordset[i].OutputId,
                "hastings": hastings,
                "sf": recordset[i].SfValue
            })
        }
        
        // API response and logging
        res.send(resJson);
        if (params.verboseApiLogs == true) {
            timeDelta = new Date() - initialTime
            console.log("GET: " + hash + " - " + timeDelta + "ms")
        }
    }
}


// Raw call to the explorer module
exports.Raw = async function(params, res, req) {
    var initialTime = new Date();
    
    // Checking the sanity of the request to avoid SQL injections
    var hash = sanitySql(req.params.hash_id)

    if (hash == "" || hash == "000000000000000000000000000000000000000000000000000000000000000089eb0d6a8a69" 
        || (hash.length != 64 && hash.length != 76)) {
        // Bad request, or the burning address, or bad length
        res.status(400).send('Wrong hash format')
    } else {
        // Explorer call to Sia daemons, response and logging
        var apiSia = await Commons.MegaRouter(params, 0, '/explorer/hashes/' + hash, true)
        if (apiSia == null) {apiSia = []}
        res.send(apiSia)
        if (params.verboseApiLogs == true) {
            timeDelta = new Date() - initialTime
            console.log("RAW REQUEST: " + req.params.hash_id + " - " + timeDelta + "ms")
        }
    }
}


// Batch of addresses
exports.AddressesBatch = async function(params, res, req) {
    var initialTime = new Date();
    var addresses = req.body.query;
    var page = parseInt(req.body.page)
    if (page > 0) {} else {
        page = 1 // Defaulting to page 1 in case of malformed POST requests
    }

    // Splits the string into an array of addresses
    addressesArray = addresses.match(/[^\r\n]+/g)
    
    // Limit to the batch limit of addresses
    addresses = addressesArray.splice(0, params.apiBatchLimit)
    
    // Sanitizing request
    var sanitizedAddresses = []
    for (var i = 0; i < addresses.length; i++) {
        hash = sanitySql(addresses[i])
        if (hash != "") {
            sanitizedAddresses.push(addresses[i])
        }
    }

    // Async bacthes of sqlArgumentsSize addresses
    recordSet = []
    while (sanitizedAddresses.length > 0) {
        // Creates a segment of sqlArgumentsSize addresses, or less if it is the rest
        if (sanitizedAddresses.length >= params.sqlArgumentsSize) {
            var addressesSegment = sanitizedAddresses.splice(0, params.sqlArgumentsSize)
        } else {
            var addressesSegment = sanitizedAddresses.splice(0, sanitizedAddresses.length)
        }

        // Composing SQL request
        var sqlQuery = "SELECT DISTINCT Address,MasterHash,ScChange,SfChange,Height,Timestamp,TxType from AddressChanges WHERE (Address = '"

        for (j = 0; j < addressesSegment.length; j++) {
            sqlQuery = sqlQuery + addressesSegment[j] + "'"
            if (j < (addressesSegment.length - 1)) {
                // If not the last one of the segment, add "OR" operator
                sqlQuery = sqlQuery + " OR Address = '"
            }
        }
        var sqlQuery = sqlQuery + ")"

        // Async call
        var result = await SqlAsync.Sql(params, sqlQuery)
        
        // Concatenating results to a single array
        recordSet = recordSet.concat(result)
    }

    // 1 - Total balance of the batch
    var balanceSc = 0
    var balanceSf = 0
    var receivedSc = 0
    var sentSc = 0
    for (var n = 0; n < recordSet.length; n++) {
        balanceSc = balanceSc + recordSet[n].ScChange
        balanceSf = balanceSf + recordSet[n].SfChange
    }
    // Do not send negative balances
    if (balanceSc < 0) {balanceSc = 0}
    if (balanceSf < 0) {balanceSf = 0}

    // 2 - Balance of each address
    var addressesBalance = []
    for (var n = 0; n < addresses.length; n++) { // For each address
        var addressSc = 0
        var addressSf = 0
        for (var m = 0; m < recordSet.length; m++) { // For each result
            if (recordSet[m].Address == addresses[n]) {
                addressSc = addressSc + recordSet[m].ScChange
                addressSf = addressSf + recordSet[m].SfChange
            }
        }
        addressesBalance.push({"address": addresses[n], "sc": addressSc, "sf": addressSf})
    }

    // 3 - Merging changes of internal transactions
    var txs = recordSet
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

    // 4 - Totals sent and received
    for (var i = 0; i < newTxs.length; i++) {
        if (newTxs[i].ScChange > 0) {
            receivedSc = receivedSc + newTxs[i].ScChange
        } else if (newTxs[i].ScChange < 0) {
            sentSc = sentSc + (newTxs[i].ScChange * -1)
        }
    }
    var txCount = newTxs.length
                
    // 5 - Order by heigt and send only 100 transactions, according to the page
    newTxs.sort(function(a,b) {
        return parseFloat(b.Height) - parseFloat(a.Height)
    })
    var trimTxs = []

    for (var m = ((page * 100) - 100); m < (page * 100) && m < txCount; m++) {
        trimTxs.push(newTxs[m])
    }

    // Constructing JSON response
    var addressResponse = []
    addressResponse.push({
        "balanceSc": balanceSc,
        "receivedSc": receivedSc,
        "sentSc": sentSc,
        "balanceSf": balanceSf, 
        "TotalTxCount": txCount, 
        "page": page})
    addressResponse.push({"addresses": addressesBalance})
    addressResponse.push({"last100Transactions": trimTxs})
    
    // Send response and log
    res.json(addressResponse);
    if (params.verboseApiLogs == true) {
        timeDelta = new Date() - initialTime
        console.log("Batch of addresses queried: " + addresses.length + " - " + timeDelta + "ms")
    }
}


// Batch of contracts
exports.ContractsBatch = async function(params, res, req) {
    var initialTime = new Date();
    var file = req.body.query;  
    
    var processedArray = preprocessHostFile(file)

    // Limit to batch limit of contracts
    contractsArray = processedArray.splice(0, params.apiBatchLimit)
    console.log("Batch of contracts queried: " + contractsArray.length)

    // Sanity checks
    var sanitizedContracts = []
    for (var i = 0; i < contractsArray.length; i++) {
        hash = sanitySql(contractsArray[i].contractId)
        if (hash != "") {
            sanitizedContracts.push(contractsArray[i])
        }
    }

    // Async bacthes of 1000 contracts
    recordSet = []
    while (sanitizedContracts.length > 0) {
        // Creates a segment of sqlArgumentsSize addresses, or less if it is the rest
        if (sanitizedContracts.length >= params.sqlArgumentsSize) {
            var contractsSegment = sanitizedContracts.splice(0, params.sqlArgumentsSize)
        } else {
            var contractsSegment = sanitizedContracts.splice(0, sanitizedContracts.length)
        }

        // Composing SQL request
        var sqlQuery = "SELECT * from ContractInfo WHERE ContractId = '"

        for (j = 0; j < contractsSegment.length; j++) {
            sqlQuery = sqlQuery + contractsSegment[j].contractId + "'"
            if (j < (contractsSegment.length - 1)) {
                // If not the last one of the segment, add "OR" operator
                sqlQuery = sqlQuery + " OR ContractId = '"
            }
        }

        // Async call
        var result = await SqlAsync.Sql(params, sqlQuery)
        
        // Concatenating results to a single array
        recordSet = recordSet.concat(result)
    }

    // 0 - Order by height
    recordSet.sort(function(a,b) {
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
    if (recordSet.length > 0) { // To avoid crashes on malformed requests, only if there is something to analyze
        for (var i = 0; i < contractsArray.length; i++) {
            var matchBool = false
            for (var j = 0; j < recordSet.length; j++) {
                if (contractsArray[i].contractId != null) { // Avoids malformed crashes due to malformed reports without contractIDs
                    if (recordSet[j].ContractId == contractsArray[i].contractId) {
                        matchBool = true
                        // Match! Adding data
                        contractsArray[i].duration = recordSet[j].WindowEnd - recordSet[j].Height
                        contractsArray[i].timestamp = recordSet[j].Timestamp
                        contractsArray[i].filesize = recordSet[j].CurrentFileSize
                        if (recordSet[j].Status == 'complete-succ' && recordSet[j].MissedProof2Value == recordSet[j].ValidProof2Value) {
                            contractsArray[i].statusnavigator = "unused" // Rename to unused those with Missed[1] == Valid[1]
                        } else {
                            contractsArray[i].statusnavigator = recordSet[j].Status
                        }
                        if (contractsArray[i].statusnavigator == "complete-fail") {
                            revenueLost = revenueLost + recordSet[j].MissedProof3Value
                            revenueNet = revenueNet - recordSet[j].MissedProof3Value
                            countFail++
                        } else if (contractsArray[i].statusnavigator == "complete-succ") {
                            // The amount sent as collateral is substracted
                            revenueGain = revenueGain + recordSet[j].ValidProof2Value - recordSet[j].HostValue
                            revenueNet = revenueNet + recordSet[j].ValidProof2Value - recordSet[j].HostValue
                            countSuccess++
                        } else if (contractsArray[i].statusnavigator == "unused") {
                            // The difference between the collateral and the returned amount (the contract fees) is added
                            countUnused++
                            revenueGain = revenueGain + recordSet[j].ValidProof2Value - recordSet[j].HostValue
                            revenueNet = revenueNet + recordSet[j].ValidProof2Value - recordSet[j].HostValue
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
    
    // Send response and log
    res.json(contractsResponse);
    if (params.verboseApiLogs == true) {
        timeDelta = new Date() - initialTime
        console.log("Contracts batch retrieved: " + recordSet.length + " - " + timeDelta + "ms")
    }
}


// Creates the CSV report of transactions history
exports.CsvFile = async function(params, res, req) {
    var initialTime = new Date();
    var addresses = req.body.addresses;
    var onlyIncoming = req.body.onlyIncoming
    var currency = req.body.currency
    var startDate = req.body.startDate
    var endDate = req.body.endDate
    if (params.verboseApiLogs == true) {
        console.log("CSV file requested for " + addresses.length + " addresses")
    }

    // A and B - SQL query and merging internal transactions
    var newTxs = await getAddressesBatchTxs(params, addresses)

    // C - SQL query getting all the rates for the user-selected currency
    var sqlQuery = "SELECT Timestamp, " + currency + ", SF FROM ExchangeRates"
    var exRates = await SqlAsync.Sql(params, sqlQuery)

    // D - Building the final CSV array
    var csvArray = []
    var now = Math.round(new Date().getTime()/1000)
    var months_arr = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    for (var i = 0; i < newTxs.length; i++) {
        correctedTimestamp = Math.floor(newTxs[i].Timestamp/86400) * 86400 // Timestamp at the beginning of the day

        // Human-legible timestamp
        var date = new Date(correctedTimestamp * 1000)
        var year = date.getFullYear()
        var month = months_arr[date.getMonth()]
        var day = date.getDate();
        if (day < 10) {day = "0" + day}
        var humanTimestamp = year + "-" + month + "-" + day
        
        // Finding exchange rate, only for txs that change the balance of SC (not SFs)
        var exchangePrice = "-" // The SC rate
        var sfExchangePrice = "-" // The SF rate
        var exangedCurrency = 0 // The transformed value (SC + SF)
        var exangedCurrencySc = "-"
        var exangedCurrencySf = "-"
        var correctedAmount = 0 // from Hastings to SC

        correctedAmount = newTxs[i].ScChange / 1000000000000000000000000
        for (var j = 0; j < exRates.length; j++) {
            if (correctedTimestamp == exRates[j].Timestamp) {
                exchangePrice = exRates[j][currency]
                exangedCurrencySc = correctedAmount * exchangePrice

                // SF
                sfExchangePrice = exRates[j].SF
                if (sfExchangePrice > 0) {
                    exangedCurrencySf = (newTxs[i].SfChange / sfExchangePrice) * exchangePrice
                }

                // Total
                if (exangedCurrencySc > 0 || exangedCurrencySc < 0) {
                    exangedCurrency = exangedCurrency + exangedCurrencySc
                }
                if (exangedCurrencySf > 0 || exangedCurrencySf < 0) {
                    exangedCurrency = exangedCurrency + exangedCurrencySf
                }
            }
        }
        
        // If the entry is from the last 24 hours, and has no assigned value, use the latest entry of the database
        if ((now - 86400) < newTxs[i].Timestamp && exchangePrice == "-" && ((newTxs[i].ScChange > 0 || newTxs[i].ScChange < 0))) {
            exchangePrice = exRates[exRates.length-1][currency]
            exangedCurrency = correctedAmount * exchangePrice
        }
        if ((now - 86400) < newTxs[i].Timestamp && sfExchangePrice == "-" && ((newTxs[i].SfChange > 0 || newTxs[i].SfChange < 0))) {
            exchangePrice = exRates[exRates.length-1].SF
            exangedCurrency = (newTxs[i].SfChange / sfExchangePrice) * exchangePrice
        }

        // Balances: aggregating transactions porcessed so far
        var balanceSc = correctedAmount
        var balanceSf = parseInt(newTxs[i].SfChange)
        for (var j = 0; j < csvArray.length; j++) {
            if (csvArray[j].sc_amount > 0 || csvArray[j].sc_amount < 0) {
                balanceSc = balanceSc + csvArray[j].sc_amount
            }
            if (csvArray[j].siafund_amount > 0 || csvArray[j].siafund_amount < 0) {
                balanceSf = balanceSf + csvArray[j].siafund_amount
            }
        }
        try { balanceSc = balanceSc * exchangePrice } catch(e) {}
        try { balanceSf = balanceSf * exangedCurrencySf } catch(e) {}
        if (balanceSc > 0) {} else {balanceSc = 0}
        if (balanceSf > 0) {} else {balanceSf = 0}
        var balanceTotal = balanceSc + balanceSf
        

        // Pushing to array
        csvArray.push({
            date: humanTimestamp,
            timestamp: newTxs[i].Timestamp,
            type: newTxs[i].TxType,
            tx_id: newTxs[i].MasterHash,
            sc_amount: correctedAmount,
            siafund_amount: newTxs[i].SfChange,
        })

        // Add currency amount
        var columnNameCurrency = currency + "_transacted"
        if (exangedCurrency != "-") {
            csvArray[csvArray.length-1][columnNameCurrency] = exangedCurrency.toFixed(8)
        } else {
            csvArray[csvArray.length-1][columnNameCurrency] = exangedCurrency
        }

        // Balance 
        var columnNameBalance = currency + "_balance_total"
        csvArray[csvArray.length-1][columnNameBalance] = balanceTotal.toFixed(8)

        // Add exchange rates only for the coins of the trade (siacoin or siafund)
        if (newTxs[i].ScChange > 0 || newTxs[i].ScChange < 0) {
            csvArray[csvArray.length-1].exchange_rate_siacoin = exchangePrice
        }
        if (newTxs[i].SfChange > 0 || newTxs[i].SfChange < 0) {
            if (sfExchangePrice > 0) {
                csvArray[csvArray.length-1].exchange_rate_siafund = exchangePrice / sfExchangePrice
            } else {
                csvArray[csvArray.length-1].exchange_rate_siafund = "-"
            }    
        }     
    }

    // E - Filtering array
    var columnNameCurrency = currency + "_transacted"
    var csvArrayFinal = []
    for (var i = 0; i < csvArray.length; i++) {
        if (parseFloat(csvArray[i][columnNameCurrency]) < 0 && onlyIncoming == "true") {
            // Do not copy this tx to the new array
        } else {
            if (csvArray[i].timestamp >= startDate && csvArray[i].timestamp <= endDate) {
                // It is in the dates range: copy it
                csvArrayFinal.push(csvArray[i])
            }
        }
    }

    // F - Converrting array to CSV and sending it
    jsonexport(csvArrayFinal,function(err, csv){
        if(err) return console.log(err);

        // Random ID
        function makeid(length) {
            var result           = '';
            var characters       = 'abcdefghijklmnopqrstuvwxyz0123456789';
            var charactersLength = characters.length;
            for ( var i = 0; i < length; i++ ) {
               result += characters.charAt(Math.floor(Math.random() * charactersLength));
            }
            return result;
        }
        var fileId = makeid(10)
        
        // Save the file
        var filePath = params.websitePath + "csv_reports/" + fileId + ".csv"
        fs.writeFileSync(filePath, csv)
        res.status(200).send({
            status: "ok", 
            file: fileId
        })

        // Delete file after 5 minutes
        setTimeout(function(){
            fs.unlinkSync(filePath);
        }, 300000);
    });

    // Log
    if (params.verboseApiLogs == true) {
        timeDelta = new Date() - initialTime
        console.log("CSV file processed in: " + timeDelta + "ms")
    }
}


// Evolution of balance of an address/es over time
exports.BalanceTrack = async function(params, res, req) {
    var initialTime = new Date();
    var addresses = req.body.addresses;
    var currency = req.body.currency
    var addressesNum = req.body.addresses.length

    // A and B - SQL query and merging internal transactions
    var txs = await getAddressesBatchTxs(params, addresses)

    // C - SQL query getting all the rates for the user-selected currency
    var sqlQuery = "SELECT Timestamp, " + currency + ", SF FROM ExchangeRates"
    var exRates = await SqlAsync.Sql(params, sqlQuery)
    exRates = exRates

    // D - Building the arrays of balances. Creating blank arrays
    var balances = []
    var now = Math.floor(Date.now() / 1000);
    var firstTrade = Math.floor(txs[0].Timestamp/86400) * 86400 // Begining of that day
    for (var i = firstTrade; i < now; i = i + 86400) {
        balances.push({
            timestamp: i,
            sc: 0,
            sf: 0
        })
    }

    // E - Assigning trades to the array
    for (var i = 0; i < txs.length; i++) {
        // Finding the position in the array according to the timestamp
        var pos = Math.floor((txs[i].Timestamp - firstTrade) / 86400)
        balances[pos].sc = balances[pos].sc + (txs[i].ScChange/1000000000000000000000000)
        balances[pos].sf = balances[pos].sf + txs[i].SfChange
    }

    // F - Transforming trades into a balance. Adding FIAT conversions. Fixed decimals (2)
    var movingBalanceSc = 0
    var movingBalanceSf = 0
    for (var i = 0; i < balances.length; i++) {
        movingBalanceSc = movingBalanceSc + balances[i].sc
        movingBalanceSf = movingBalanceSf + balances[i].sf
        balances[i].sc = parseFloat(movingBalanceSc.toFixed(2))
        balances[i].sf = movingBalanceSf

        // Finding the conversion rate
        for (var j = 0; j < exRates.length; j++) {
            if (balances[i].timestamp == exRates[j].Timestamp) {
                balances[i].scUsd = parseFloat((balances[i].sc * exRates[j][currency]).toFixed(2))
                balances[i].sfUsd = parseFloat((balances[i].sf * exRates[j][currency] / exRates[j].SF).toFixed(2))
            }
        }

        // If TX is too recent, use the latest conversion rate
        if (balances[i].timestamp > exRates[exRates.length-1].Timestamp) {
            balances[i].scUsd = parseFloat((balances[i].sc * exRates[exRates.length-1][currency]).toFixed(2))
            balances[i].sfUsd = parseFloat((balances[i].sf * exRates[exRates.length-1][currency] / exRates[exRates.length-1].SF).toFixed(2))
        }
    }

    // G - Building Highcharts-friendly arrays
    scJson = []
    scUsdJson = []
    sfJson = []
    sfUsdJson = []
    scDataBool = false // Did this address ever had a SC balance?
    sfDataBool = false // Did this address ever had a SF balance?
    for (var i = 0; i < balances.length; i++) {
        balances[i].timestamp = balances[i].timestamp * 1000
        scJson.push([balances[i].timestamp, balances[i].sc])
        scUsdJson.push([balances[i].timestamp, balances[i].scUsd])
        sfJson.push([balances[i].timestamp, balances[i].sf])
        sfUsdJson.push([balances[i].timestamp, balances[i].sfUsd])
        if (balances[i].sc > 0) { scDataBool = true }
        if (balances[i].sf > 0) { sfDataBool = true }
    }

    // H - REST response and logging
    res.status(200).send({
        status: "ok", 
        scDataBool: scDataBool,
        sfDataBool: sfDataBool,
        scJson: scJson,
        scUsdJson: scUsdJson,
        sfJson: sfJson,
        sfUsdJson: sfUsdJson
    })
    if (params.verboseApiLogs == true) {
        timeDelta = new Date() - initialTime
        console.log("Balance track requested for " + addressesNum + " addresses - Processed in " + timeDelta + "ms")
    }
}


// Generates an QR code from an address hash and sends it as an svg
exports.Qr = async function(params, res, req) {
    var address = req.params.hash.slice(0, -4)

    // Checking the sanity of the request to avoid SQL injections
    var hashReq = sanitySql(address)

    if (hashReq.length == 76) {
        // It is an address
        var qrOptions = {
            type: "svg",
            width: 200,
            margin: 0, 
            errorCorrectionLevel: "L",
            color: {
                dark: params.colors.qrCodeBackground,
                light: params.colors.qrCode
            }
        }
    
        qrcode.toString(hashReq, qrOptions, function (err, url) {
            res.status(200, "image/svg+xml").send(url)   
        })
    } else {
        // Bad request
        res.status(400).send()
    }
}


// Returns data from the last 10 blockchain reorgs
exports.Reorgs = async function(params, res, req) {
    var reorgs = []

    // First, we detect the latest reorg
    var sqlQuery = SqlComposer.SelectTop(params, "Reorgs", "ReorgEventNum", "ReorgEventNum", 1)
    var sql = await SqlAsync.Sql(params, sqlQuery)
    if (sql.length != 0) {
        var latestReorg = sql[0].ReorgEventNum

        // SQL retrieval of the latest 10 reorgs
        var sqlQuery = "SELECT * FROM Reorgs WHERE ReorgEventNum > " + (latestReorg - 10)
        var sqlReorgs = await SqlAsync.Sql(params, sqlQuery)

        // Building the API
        for (var i = latestReorg; (i > (latestReorg-10) && i > 0); i--) {
            reorgs.push({
                eventNum: i,
                blocks: []
            })
            
            for (var j = 0; j < sqlReorgs.length; j++) {
                if (sqlReorgs[j].ReorgEventNum == i) {
                    reorgs[reorgs.length-1].timestamp = sqlReorgs[j].DetectionTimestamp
                    reorgs[reorgs.length-1].blocks.push({
                        height: sqlReorgs[j].Height,
                        hash: sqlReorgs[j].Hash,
                        miningAddress: sqlReorgs[j].MiningAddress,
                        miningPool: sqlReorgs[j].MiningPool,
                        replacingHash: sqlReorgs[j].ReplacingHash,
                        replacingMiningAddress: sqlReorgs[j].ReplacingMiningAddress,
                        replacingMiningPool: sqlReorgs[j].ReplacingMiningPool,
                    })
                }
            }
        }
    }

    res.status(200).send(reorgs)
}


// Coin supply in plain number, as requested by CMC
exports.TotalCoins = async function(params, res, req) { 
    var sqlQuery = SqlComposer.SelectTop(params, "BlockInfo", "TotalCoins", "Height", 1)
    var topBlock = await SqlAsync.Sql(params, sqlQuery)
    var coinSupply = Math.round(topBlock[0].TotalCoins / params.blockchain.coinPrecision)
    if (coinSupply > 0) {
        res.setHeader("Content-Type", "text/plain")
        res.status(200).send(coinSupply.toString())
    } else {
        // Not available right now
        res.status(404).send()
    }
}


// ============================
// Common methods and functions
// ============================

async function searchUnconfirmed(params, hashReq, resJson) {
    // Searches the database of unconfirmed changes of addresses
    var sqlQuery = "SELECT ScValue,SfValue,TxType,Timestamp FROM UnconfirmedBalances WHERE Address = '" + hashReq + "'"
    var recordsetUnconfirmed = await SqlAsync.Sql(params, sqlQuery)
    var pendingSc = 0
    var pendingSf = 0
    for (var i = 0; i < recordsetUnconfirmed.length; i++) {
        pendingSc = pendingSc + recordsetUnconfirmed[i].ScValue
        pendingSf = pendingSf + recordsetUnconfirmed[i].SfValue
    }

    // Response
    if (recordsetUnconfirmed.length > 0) {
        var resJson = [
            {
                "Type": "address",
                "MasterHash": hashReq
            },
            {
                "balanceSc": 0,
                "receivedSc": 0,
                "sentSc": 0,
                "balanceSf": 0, 
                "TotalTxCount": 0, 
                "firstSeen": "-", 
                "last100Transactions": [],
                "pendingSc": pendingSc,
                "pendingSf": pendingSf,
                "unconfirmedTransactions": recordsetUnconfirmed
            }
        ]
    }
    
    return resJson
}


async function searchMempool(params, hashReq, resJson) {
    // Searches the hash on the mempool: if exists, will return an "unconfirmed" type. Otherwise, an empty object

    var apiRaw = await Commons.MegaRouter(params, 0, '/tpool/raw/' + hashReq, true)
    if (apiRaw != null) {
        //If there is a response from this call, the TX is in the mempool
        var resJson = [{
            "Type": "unconfirmed",
            "MasterHash": hashReq
        }]
    
    } else {
        // Id there is an error from this call, the TX does not exist on the mempool
        // However, during a few seconds, the TX may be not in the mempool once integrated on a block but not yet on my SQL database, so I
        // do this second call to /tpool/confirmed, and return a temporal "unconfirmed" if the response is "true" (next inquire will return 
        // the full info once integrated on the SQL database)
        var apiConfirmed = await Commons.MegaRouter(params, 0, '/tpool/confirmed/' + hashReq, true)
        if (apiConfirmed.confirmed == true) {
            var resJson = [{
                "Type": "unconfirmed",
                "MasterHash": hashReq
            }]
        }
    }
    
    return resJson
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
        hash = null
    }
    
    return hash
}


async function getAddressesBatchTxs(params, addresses) {
    // Gets a batch of addresses and returns the transaction history, ordered

    // Limit to the batch limit number of addresses addresses
    addresses = addresses.splice(0, params.apiBatchLimit)
    
    // Sanitizing request
    var sanitizedAddresses = []
    for (var i = 0; i < addresses.length; i++) {
        hash = sanitySql(addresses[i])
        if (hash != "") {
            sanitizedAddresses.push(addresses[i])
        }
    }

    // Async bacthes of 1000 addresses
    recordSet = []
    while (sanitizedAddresses.length > 0) {
        // Creates a segment of sqlArgumentsSize addresses, or less if it is the rest
        if (sanitizedAddresses.length >= params.sqlArgumentsSize) {
            var addressesSegment = sanitizedAddresses.splice(0, params.sqlArgumentsSize)
        } else {
            var addressesSegment = sanitizedAddresses.splice(0, sanitizedAddresses.length)
        }

        // Composing SQL request
        var sqlQuery = "SELECT DISTINCT Address,MasterHash,ScChange,SfChange,Height,Timestamp,TxType from AddressChanges WHERE (Address = '"
        for (j = 0; j < addressesSegment.length; j++) {
            sqlQuery = sqlQuery + addressesSegment[j] + "'"
            if (j < (addressesSegment.length - 1)) {
                // If not the last one of the segment, add "OR" operator
                sqlQuery = sqlQuery + " OR Address = '"
            }
        }
        var sqlQuery = sqlQuery + ")"

        // Async call
        var result = await SqlAsync.Sql(params, sqlQuery)
        
        // Concatenating results to a single array
        recordSet = recordSet.concat(result)
    }

    // A - Merging changes of internal transactions
    var txs = recordSet
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
    
    // B - Order by height
    newTxs.sort(function(a,b) {
        return parseFloat(a.Height) - parseFloat(b.Height)
    })
    
    return newTxs
}


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
