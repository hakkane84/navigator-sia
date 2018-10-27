var sia = require('C:/nodejs/node_modules/sia.js');
var fs = require('fs');

// Load external modules
var SqlFunctions = require('../modules/sqlfunctions.js')
var Siafunds = require('../modules/siafunds.js')
var Siacoins = require('../modules/siacoins.js')
var FileContracts = require('../modules/filecontracts.js')
var sql = require('C:/nodejs/node_modules/mssql');

// GLOBAL PARAMETERS
// Delay between blocks (avoids the SQL controller choking), as number of requests per second. Default: 500
var queriesPerSecond = 500
// Time between sia API consensus calls to check the presence of a new block, in milliseconds. Default: 20000
consensusCheckTime = 20000

// Parameters for accessing the SQL database (Customize also in modules/sqlfunctions.js)
var sqlLogin = {
    server: 'localhost',
    database: 'navigator',
    user: 'xxx',
    password: 'xxx',
    port: 1433,
    connectionTimeout: 60000,
    requestTimeout: 60000,
    pool: {
        max: 1000,
        min: 0,
        idleTimeoutMillis: 30000
    }
};


console.log("============================================")
console.log("     STARTING NAVIGATOR - Block repair")
console.log("============================================")


// For indexing an individual block manually: write it as an array with one element
var blocks = [151733]
console.log("Repairing " + blocks.length + " blocks")


// Deletes the block first
SqlFunctions.deleteBlocks(blocks)
console.log("Deleting blocks")

setTimeout(function() { 
    console.log("Blocks deleted")
    sqlBatch = []
    
    // Loading poolsDb, database with the known addresses of mining pools
    var data1 = '';
    var chunk1;
    var stream1 = fs.createReadStream("poolAddresses.json")
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

        // Main loop
        blockRequest(blocks, sqlBatch, poolsDb)
    })
}, 30000);




function blockRequest(remainingBlocks, sqlBatch, poolsDb) {
    // The block to index is the first in the the array of remaining blocks
    var block = remainingBlocks[0]

    sia.connect('localhost:9980')
    .then((siad) => {
        siad.call({ 
            url: '/explorer/blocks/' + block,
            method: 'GET'
        })
        .then((rawblock) =>  {
            // Pre-processing the block (had some issues in the past parsing the result, so I rather remove characters from the string)
            var stringraw = JSON.stringify(rawblock)
            var a = stringraw.substr(0, stringraw.length-1) //This removes the last "}"
            var b = a.slice(9, a.length) // Removes first characters
            var apiblock = JSON.parse(b)
            var height = parseFloat(apiblock.height)
            var timestamp = parseFloat(apiblock.rawblock.timestamp)
            
            // Check all the transactions in the block
            var minerPayoutTxId = ""
            var minerArbitraryData = ""
            var bucketMinerFees = 0
            var totalAddresses = [] // Saves all the addresses used in the block, for posterior processing
            var txsIndexed = [] // Collects all the TXs number already indexed
            var newTransactions = apiblock.transactions.length
            var newContracts = 0
            var minerPayoutTxId = ""
            var minerArbitraryData = ""

            if (apiblock.height == 0) {
                var n = 0 // Genesis has only 1 transaction
                // SFs in the Genesis Block (#0) are a special case
                var addSql = Siafunds.genesisBlockProcess(apiblock, n, height, timestamp)
                sqlBatch = sqlBatch.concat(addSql)
            } else {
                for (var n = 0; n < apiblock.transactions.length; n++) {
                    
                    // SF TRANSACTIONS: First condition detects that the TX is SF involved. Second condition the receiver
                    if (apiblock.transactions[n].rawtransaction.siafundinputs.length != 0 && apiblock.transactions[n].rawtransaction.siacoininputs.length != 0) {
                        //console.log("Tx affected: " + n)
                        var returnArray = Siafunds.sfTransactionProcess(apiblock, n, height, timestamp)
                        sqlBatch = sqlBatch.concat(returnArray[0])
                        txsIndexed = txsIndexed.concat(returnArray[1])
                    }

                    // SC TRANSACTIONS (pure transactions, unrelated to file contract activity)
                    // They get identified as containing siacoininputs, paying miner fees, and negative for siafunds, contracts, revissions and proofs
                    if (apiblock.transactions[n].rawtransaction.siacoininputs.length != 0
                        && apiblock.transactions[n].rawtransaction.minerfees.length != 0
                        && apiblock.transactions[n].rawtransaction.filecontracts.length == 0
                        && apiblock.transactions[n].rawtransaction.filecontractrevisions.length == 0
                        && apiblock.transactions[n].rawtransaction.storageproofs.length == 0
                        && apiblock.transactions[n].rawtransaction.siafundinputs.length == 0
                        && apiblock.transactions[n].rawtransaction.siafundoutputs.length == 0
                    ) {
                        var returnArray = Siacoins.scTransactionProcess(apiblock, n, height, timestamp)
                        // returnArray returns the 0- SQL sentences 1- addreses used in a TX, 2- TXs marked as indexed. As they repeat inside a block, this is problematic for SQL, so I collect them and
                        // afterwards I sort them and de-duplicate them before saving them
                        sqlBatch = sqlBatch.concat(returnArray[0])
                        var addresses = returnArray[1]
                        for (var m = 0; m < addresses.length; m++) {
                            totalAddresses.push(addresses[m])
                        }
                        txsIndexed = txsIndexed.concat(returnArray[2])
                    }
                    
                    
                    // FILE CONTRACTS
                    if (apiblock.transactions[n].rawtransaction.filecontracts != "") {
                        var returnArray = FileContracts.fileContractsProcess(apiblock, n, height, timestamp)
                        sqlBatch = sqlBatch.concat(returnArray[0])
                        var addresses = returnArray[1]
                        for (var m = 0; m < addresses.length; m++) {
                            totalAddresses.push(addresses[m])
                        }
                        newContracts++
                        txsIndexed = txsIndexed.concat(returnArray[2])
                    }

                    // CONTRACT REVISIONS
                    if (apiblock.transactions[n].rawtransaction.filecontractrevisions != "") {
                        var returnArray = FileContracts.revisionProcess(apiblock, n, height, timestamp)
                        sqlBatch = sqlBatch.concat(returnArray[0])
                        var addresses = returnArray[1]
                        for (var m = 0; m < addresses.length; m++) {
                            totalAddresses.push(addresses[m])
                        }
                        txsIndexed = txsIndexed.concat(returnArray[2])
                    }

                    // PROOFS OF STORAGE
                    if (apiblock.transactions[n].rawtransaction.storageproofs != "") {
                        var returnArray = FileContracts.proofProcess(apiblock, n, height, timestamp)
                        sqlBatch = sqlBatch.concat(returnArray[0])
                        var addresses = returnArray[1]
                        for (var m = 0; m < addresses.length; m++) {
                            totalAddresses.push(addresses[m])
                        }
                        txsIndexed = txsIndexed.concat(returnArray[2])
                    }

                    // DETECTING THE MINER PAYOUT TX
                    // Some pools add this TX as the first in the block, some others, as the last. In both cases, it is an empty TX
                    if (apiblock.transactions[n].rawtransaction.siacoininputs.length == 0
                        && apiblock.transactions[n].rawtransaction.siacoinoutputs.length == 0
                        && apiblock.transactions[n].rawtransaction.minerfees.length == 0
                        && apiblock.transactions[n].rawtransaction.filecontracts.length == 0
                        && apiblock.transactions[n].rawtransaction.filecontractrevisions.length == 0
                        && apiblock.transactions[n].rawtransaction.storageproofs.length == 0
                        && apiblock.transactions[n].rawtransaction.siafundinputs.length == 0
                        && apiblock.transactions[n].rawtransaction.siafundoutputs.length == 0
                        && apiblock.transactions[n].rawtransaction.arbitrarydata.length > 0
                    ) {
                        var arbitraryData = apiblock.transactions[n].rawtransaction.arbitrarydata
                        slice = arbitraryData[0].slice(0,14)
                        if (slice != "SG9zdEFubm91bm") { // Otherwise, it would just be a legacy host announcement
                            minerPayoutTxId = apiblock.transactions[n].id
                            minerArbitraryData = apiblock.transactions[n].rawtransaction.arbitrarydata[0]
                            txsIndexed.push(n) // Marking this TX as indexed
                        }
                    }

                    // EXCEPTION: Legacy Host announcements
                    // Some very old transactions anounce a host without paying miner fees or transacting a single siacoin
                    if (apiblock.transactions[n].rawtransaction.siacoininputs.length == 0
                        && apiblock.transactions[n].rawtransaction.siacoinoutputs.length == 0
                        && apiblock.transactions[n].rawtransaction.arbitrarydata.length > 0) {
                            
                            var arbitraryData = apiblock.transactions[n].rawtransaction.arbitrarydata
                            slice = arbitraryData[0].slice(0,14)
                            if (slice == "SG9zdEFubm91bm") {
                                var masterHash = apiblock.transactions[n].id
                                var hostIp = arbitraryData[0]
                                var s = hostIp.search("AAAAAAAAA")
                                hostIp = hostIp.slice(s+9)
                                var decodedIp = Buffer.from(hostIp, 'base64').toString('ascii')
                                
                                // Tx as a hash type
                                var toAddHashTypes = "('" + masterHash + "','host ann','" + masterHash + "')"
                                sqlBatch.push(SqlFunctions.insertSql("HashTypes", toAddHashTypes, masterHash))
                                // Host announcement info Info
                                var toAddHostAnnInfo = "('" + masterHash + "',''," + height + "," + timestamp + ",0,'" + decodedIp + "')"
                                sqlBatch.push(SqlFunctions.insertSql("HostAnnInfo", toAddHostAnnInfo, masterHash))
                                // TX as a component of a block
                                var toAddBlockTransactions = "(" + height + ",'" + masterHash + "','host ann',0,0)"
                                sqlBatch.push(SqlFunctions.insertSql("BlockTransactions", toAddBlockTransactions, masterHash))

                                txsIndexed.push(n) // Marking this TX as indexed
                            }
                        }
                    
                    // Adding the miner fees to the "bucket" for the block reward
                    if (apiblock.transactions[n].rawtransaction.minerfees != "") {
                        bucketMinerFees = bucketMinerFees + parseInt(apiblock.transactions[n].rawtransaction.minerfees)
                    }

                }

                // SPECIAL CASE: SC TXs NOT PAYING MINER FEES
                // Certain mining pools, like F2pool and some others unknown pools are including their pool payouts as transactions that do not pay miner fees
                // Actually, certain blocks are exclusively formed by these transactions. I am indexing them as "single" transactions (not the "duets" of senderTX-receiverTX),
                // not checking if they are chained between them, as this structure could be very complex and hard to follow. 
                // I honestly don't know what these pools are doing in these transactions...
                // For these cases, I check those Txs not yet indexed
                for (var i = 0; i < apiblock.transactions.length; i++) { // For each transaction in block
                    var thisTxAlreadyIndexed = false // Checking boolean
                    for (var j = 0; j < txsIndexed.length; j++) { // Check every tx already indexed
                        if (i == txsIndexed[j]) { // A match
                            thisTxAlreadyIndexed = true
                        }
                    }
                    // Now, if this transaction[i] was not indexed, and it is actually a ScTx, proceed to index
                    if (thisTxAlreadyIndexed == false && apiblock.transactions[i].rawtransaction.siacoinoutputs.length != 0) {
                        var returnArray = Siacoins.scSingleTransaction(apiblock, i, height, timestamp)
                        sqlBatch = sqlBatch.concat(returnArray[0])
                        var addresses = returnArray[1]
                        for (var m = 0; m < addresses.length; m++) {
                            totalAddresses.push(addresses[m])
                        }
                    }
                    // ANOTHER EXCEPTIONAL CASE: SF TX "ORPHANED" (a singlet TX not paying fees, again due to F2pool)
                    if (thisTxAlreadyIndexed == false && apiblock.transactions[i].rawtransaction.siafundoutputs.length != 0) {
                        var returnArray = Siafunds.sfSingleTransaction(apiblock, i, height, timestamp)
                        sqlBatch = sqlBatch.concat(returnArray[0])
                        var addresses = returnArray[1]
                        for (var m = 0; m < addresses.length; m++) {
                            totalAddresses.push(addresses[m])
                        }
                    }
                }

                // Saving all the addresses used in this block
                var addSql = Siacoins.addressesSave(totalAddresses)
                sqlBatch = sqlBatch.concat(addSql)

            }
            
            // MINER PAYOUT TX: Instead of processing the first and/or last transaction (some pools include info on both), I calculate the reward
            if (apiblock.height > 0) { // Genesis block was not mined

                var blockReward = 300000 - height
                if (blockReward < 30000) {blockReward = 30000} // Minimal block reward will always be 30000
                var totalBlockReward = (blockReward * 1000000000000000000000000) + bucketMinerFees // Miner receives the block reward + collected fees, in Hastings
                
                // SAVING THE DATA
                // Address change
                var payoutAddress = apiblock.rawblock.minerpayouts[0].unlockhash
                var payoutHash = minerPayoutTxId
                var toAddAddressChanges = "('" + payoutAddress + "','" + payoutHash + "'," + totalBlockReward + "," + 0 + "," + height + "," + timestamp + ",'blockreward')"
                var checkString = payoutAddress + "' and MasterHash='" + payoutHash 
                sqlBatch.push(SqlFunctions.insertSql("AddressChanges", toAddAddressChanges, checkString))
                
                // Address as hash type
                var toAddHashTypes = "('" + payoutAddress + "','address','')"
                sqlBatch.push(SqlFunctions.insertSql("HashTypes", toAddHashTypes, payoutAddress))
                
                // Miner payout as hash type
                var toAddHashTypes = "('" + payoutHash + "','blockreward','')"
                sqlBatch.push(SqlFunctions.insertSql("HashTypes", toAddHashTypes, payoutHash))
            
                // Tx info
                var toAddTxInfo = "('" + payoutHash + "',''," + height + "," + timestamp + ",null)"
                sqlBatch.push(SqlFunctions.insertSql("TxInfo", toAddTxInfo, payoutHash))

                // Saving TX as a component of a block
                var toAddBlockTransactions = "(" + height + ",'" + payoutHash + "','blockreward'," + totalBlockReward + ",0)"
                sqlBatch.push(SqlFunctions.insertSql("BlockTransactions", toAddBlockTransactions, payoutAddress))
            }

            // Block metadata processing
            var height = parseFloat(apiblock.height)
            var timestamp = parseFloat(apiblock.rawblock.timestamp)
            var transactionCount = parseFloat(apiblock.transactioncount)
            var blockHash = apiblock.blockid
            if (height > 0) {
                var minerAddress = apiblock.rawblock.minerpayouts[0].unlockhash
            } else { // The genesis block was not mined
                minerAddress = "Genesis block"
            }
            
            // Mining pool
            var miningPool = "Unknown" // By default
            for (var a = 0; a < poolsDb.length; a++) { // For each pool
                for (var b = 0; b < poolsDb[a].addresses.length; b++) { // For each address
                    if (minerAddress == poolsDb[a].addresses[b]) {
                        miningPool = poolsDb[a].name
                        b = poolsDb[a].addresses.length // Finishes the loop
                    }
                }
                if (miningPool != "Unknown") {
                    a = poolsDb.length // Finishes the loop
                }
            }
            
            var toAddBlockInfo = "(" + height + "," + timestamp + "," + transactionCount + ",'" + blockHash + "','" + minerAddress + "','"
                + minerArbitraryData + "'," + parseInt(apiblock.difficulty) + "," + parseInt(apiblock.estimatedhashrate) + "," + parseInt(apiblock.totalcoins) + ","
                + parseInt(apiblock.siacoininputcount) + "," + parseInt(apiblock.siacoinoutputcount) + "," + parseInt(apiblock.filecontractrevisioncount) + "," + parseInt(apiblock.storageproofcount) + "," 
                + parseInt(apiblock.siafundinputcount) + "," + parseInt(apiblock.siafundoutputcount) + "," + parseInt(apiblock.activecontractcost) + ","
                + parseInt(apiblock.activecontractcount) + "," + parseInt(apiblock.activecontractsize) + "," + parseInt(apiblock.totalcontractcost) + ","
                + parseInt(apiblock.filecontractcount) + "," + parseInt(apiblock.totalcontractsize) + "," + newContracts + "," + newTransactions
                + ",'" + miningPool + "'," + parseInt(apiblock.minerfeecount) + ")"
            sqlBatch.push(SqlFunctions.insertSql("BlockInfo", toAddBlockInfo, height));

            // Block as a hash type
            var toAddHashTypes = "('" + blockHash + "','block'," + height + ")"
            sqlBatch.push(SqlFunctions.insertSql("HashTypes", toAddHashTypes, blockHash))
            var toAddHashTypes2 = "('" + height + "','block'," + height + ")"
            sqlBatch.push(SqlFunctions.insertSql("HashTypes", toAddHashTypes2, height))

            // Resolving contracts where no proof of storage was provided: contract is marked as failed, outputs are resolved
            SqlFunctions.resolveFailedContracts(height, timestamp)

            // Creating the merged SQL operation and sending it to SQL
            //var sqlQuery = ""
            //for (var i = 0; i < sqlBatch.length; i++) {
                //var sqlQuery = sqlQuery + sqlBatch[i] + " "
            //}
            //SqlFunctions.insertFinalSql(sqlQuery)

            // Report
            console.log("Block added: " + height + " - Txs: " + apiblock.transactions.length + " - SQL queries: " + sqlBatch.length)

            // Removing the block we just indexed from the array of pending blocks
            remainingBlocks.splice(0, 1)


            if (remainingBlocks.length > 0) { // If more blocks remaining, next request after the delay
                blockRequest(remainingBlocks, sqlBatch, poolsDb) 
            } else {
                saveSqlBatch(sqlBatch)
            }
            

        })
    })
    .catch((err) => {
        console.error(err)
    })
}

function saveSqlBatch(sqlBatch) {
    // Saving queries accumulated with a delay, to avoid chocking the controller
    console.log("Saving SQL queries: " + sqlBatch.length)

    var n = 0
    sqlLoop(sqlBatch, n)

    function sqlLoop(sqlBatch, n) {
        insertFinalSql(sqlBatch[n])
        n++
        if (n < sqlBatch.length) {
            setTimeout(function() { 
                sqlLoop(sqlBatch, n) 
            }, 20); // 50 queries per second
        }
    }

}


function insertFinalSql(sqlQuery) {
    // Local version of the function, working with a bigger pool of SQL requests
    // This SQL request adds the info only if no entry exists for the checked condition
    var dbConn = new sql.ConnectionPool(sqlLogin);
    dbConn.connect().then(function () {
        var request = new sql.Request(dbConn);
        request.query(sqlQuery).then(function (recordSet) {
            //console.log(recordSet);
            dbConn.close();
            
        }).catch(function (err) {
            //console.log(err);
            dbConn.close();
        });
    }).catch(function (err) {
        console.log(err);
    });
}
