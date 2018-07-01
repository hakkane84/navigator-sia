console.log("======================================================")
console.log("                  STARTING NAVIGATOR")
console.log("======================================================")

// Dependencies
var sia = require('C:/nodejs/node_modules/sia.js');
var fs = require('fs');
var sql = require('C:/nodejs/node_modules/mssql');

// Load external modules
var SqlFunctions = require('./modules/sqlfunctions.js')
var Siafunds = require('./modules/siafunds.js')
var Siacoins = require('./modules/siacoins.js')
var FileContracts = require('./modules/filecontracts.js')

// Parameters for accessing the SQL database (Customize also in modules/sqlfunctions.js)
var sqlLogin = {
    server: 'localhost',
    database: 'navigator',
    user: 'your_user', // CHANGE THIS
    password: 'your_password', // CHANGE THIS
    port: 1433,
    connectionTimeout: 60000,
    requestTimeout: 60000,
    pool: {
        max: 100,
        min: 0,
        idleTimeoutMillis: 30000
    }
};

// GLOBAL PARAMETERS
// Delay between blocks (avoids the SQL controller choking), as number of requests per second. Default: 500
var queriesPerSecond = 500
// Time between sia API consensus calls to check the presence of a new block, in milliseconds. Default: 20000
consensusCheckTime = 20000
// Certain blocks are impossible to be indexed as Sia.js always return an ESOCKETTIMEDOUT. This aray contains those to be skipped
blocksToSkip = [34258, 34393, 34396, 34571, 34667, 34683, 137404]



// Scheme of the program:
// 0- Launch REST server
// 1- Retrieve consensus block
// 2- Retrieve blocks in the database
// 2b- Delete the last 4 blocks for sanity
// 3- Build the array of blocks to index
// 4- On main loop, upon reaching consensus block instead of iterate again, go to a consensusCheck function
// 4b- Create tabbles of last TX and TX distribution chart data
// 5- If last indexed block < consunsus, do not iterate again in this function and instead build a new array to index
// 6- Delete the last 4 blocks
// 7- Iterate again on main loop, go to 4 and repeat infinitely


// 1 - Retrieving the last consensus block
sia.connect('localhost:9980').then((siad) => { siad.call('/consensus').then((consensus) =>  {
    var consensusBlock = consensus.height
    consensusBlock = parseFloat(consensusBlock)

    console.log("Last block in the blockchain: " + consensusBlock)

    // 2 - Retrieving the blocks available in the database
    var sqlQuery = "SELECT DISTINCT Height FROM BlockInfo"
    var dbConn = new sql.ConnectionPool(sqlLogin);
    dbConn.connect().then(function () {
        var request = new sql.Request(dbConn);
        request.query(sqlQuery).then(function (recordSet) {
            dbConn.close();

            // Saving blocks in an array
            var blocksInDb = []
            for (var n = 0; n < recordSet.recordset.length; n++) {
                blocksInDb.push(parseInt(recordSet.recordset[n].Height))
            }
            blocksInDb.sort( function(a, b) {return a-b} )
            console.log("Blocks available on the SQL database: " + blocksInDb.length)

            // 2b - Deleting the last 4 blocks of the database. This avoids issues of blockchain rearrangements
            if (blocksInDb.length > 5) { // Only if there is something to delete...
                var blocksToDelete = [blocksInDb[blocksInDb.length-1], blocksInDb[blocksInDb.length-2], blocksInDb[blocksInDb.length-3], blocksInDb[blocksInDb.length-4]]
                SqlFunctions.deleteBlocks(blocksToDelete)
            }

            saveStatusFile(consensusBlock, blocksInDb[blocksInDb.length - 5])

            setTimeout(function() { // Delay of 20 seconds to allow it to delete blocks and avoid race conditions
                
                // 3 - Building the array of blocks to index (includes the start of the main loop)
                blockArrayBuild(blocksInDb, consensusBlock, blocksToDelete) 

            }, 20000);

            
        }).catch(function (err) {
            console.log(err);
            dbConn.close();
        });
    }).catch(function (err) {
        console.log(err);
    });
    
})}).catch((err) => {console.error(err)}) // Errors of Sia Consensus call


function blockArrayBuild(blocksInDb, consensusBlock, blocksToDelete)  {
    // Constructs the array of blocks to index
    var blocks = []
    if (blocksInDb.length > 0) {
        blocksInDb.sort( function(a, b) {return a-b} )
        // A - checking gaps in database 
        if (blocksInDb.length > 1) {
            for (var m = 1; m < blocksInDb.length; m++) { // Check all the blocks already indexed
                var gap = parseInt(blocksInDb[m]) - parseInt(blocksInDb[m-1]) - 1
                for (var o = 0; o < gap; o++) {
                    // Adding blocks per each gap lenght
                    var missingBlock = parseInt(blocksInDb[m-1]) + o + 1
                    blocks.push(missingBlock)
                }
            }
        }
        //console.log("Gap blocks: " + blocks)

        // B - Filling up the DB until we reach consensus block
        for (var n = (blocksInDb[blocksInDb.length-1] + 1); n <= consensusBlock; n++) {
            blocks.push(n)
        }

    } else { // If the database is empty, first indexing
        for (var n = 0; n <= consensusBlock; n++) {
            blocks.push(parseFloat(n))
        }
    }

    // C - Removing blacklisted blocks
    for (var q = 0; q < blocksToSkip.length; q++) {
        for (var r = 0; r < blocks.length; r++) {
            if (blocks[r] == blocksToSkip[q]) {
                blocks.splice(r, 1)
                r = blocks.length
            }
        }
    }

    blocks = blocks.concat(blocksToDelete) // Adding the blocks that we are deleting
    blocks.sort( function(a, b) {return a-b} )
    console.log("Blocks to index: " + blocks.length)
    
    // Loading poolsDb, database with the known addresses of mining pools
    var data1 = '';
    var chunk1;
    var stream1 = fs.createReadStream("../poolAddresses.json")
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
        blockRequest(blocks, poolsDb)
    })
}



function blockRequest(remainingBlocks, poolsDb) {
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
            
            if (block =! apiblock.height && apiblock.height > 0) {
                // This check reveals the EXPLORER module of Sia has returned an incorrect block. Usually, this is due to a corruption of
                // its database
                console.log("Incorrect block retreived. Explorer module might be corrupted. New request in 5 minutes")
                setTimeout(function() { 
                    blockRequest(remainingBlocks, poolsDb) 
                }, 30000);
            } else {
                // Check all the transactions in the block
                var minerPayoutTxId = ""
                var minerArbitraryData = ""
                var bucketMinerFees = 0
                var totalAddresses = [] // Saves all the addresses used in the block, for posterior processing
                var sqlBatch = [] // Saves all the sql insert requests, to later add them in a single connection, or administer it as a queue
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
                        // NOTE: strikingly, the same Tx Hash announcing the same host (legacy) can appear in multiple blocks. For consistency, and due to the small
                        // value it has showing these multiple transactions, I am not making an exception that allows duplicated hashes in my database
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
                matchPool = false
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
                    + ",'" + miningPool + "')"
                sqlBatch.push(SqlFunctions.insertSql("BlockInfo", toAddBlockInfo, height));

                // Block as a hash type
                var toAddHashTypes = "('" + blockHash + "','block'," + height + ")"
                sqlBatch.push(SqlFunctions.insertSql("HashTypes", toAddHashTypes, blockHash))
                var toAddHashTypes2 = "('" + height + "','block'," + height + ")"
                sqlBatch.push(SqlFunctions.insertSql("HashTypes", toAddHashTypes2, height))

                // Resolving contracts where no proof of storage was provided: contract is marked as failed, outputs are resolved
                SqlFunctions.resolveFailedContracts(height, timestamp)

                // Creating the merged SQL operation and sending it to SQL
                var sqlQuery = ""
                for (var i = 0; i < sqlBatch.length; i++) {
                    var sqlQuery = sqlQuery + sqlBatch[i] + " "
                }
                SqlFunctions.insertFinalSql(sqlQuery)

                // Report
                console.log("Block added: " + height + " - Txs: " + apiblock.transactions.length + " - SQL queries: " + sqlBatch.length)

                // Removing the block we just indexed from the array of pending blocks
                remainingBlocks.splice(0, 1)

                // Requesting the next block. I use a dyamic delay depending on the size of the batch of SQL queries, to avoid the program to choke
                // Default: 1 second for each 500 queries
                var delaySeconds = Math.ceil(sqlBatch.length / queriesPerSecond)
                var delay = delaySeconds * 1000
                if (remainingBlocks.length > 0) { // If more blocks remaining, next request after the delay
                    setTimeout(function() { 
                        blockRequest(remainingBlocks, poolsDb) 
                    }, delay);
                } else {
                    setTimeout(function() { // 5 seconds delay for safety, to avoid possible race conditions

                        // Creating the tables and chart for the main page about last operations
                        setTimeout(function() { // Additional timeout
                            SqlFunctions.lastTxsStats()
                        }, 20000);

                        // Exiting this loop and going to consensusCheck. Takes the current height to there
                        console.log("Indexing done, awaiting Consensus for new blocks")
                        consensusCheck(height)

                    }, 5000);
                }
            }
        })
    })
    .catch((err) => {
        console.error(err)
        blockRequest(remainingBlocks, poolsDb) // Insist if an error
    })
}



function consensusCheck(dbHeight) {

    // A - Consensus check: checks periodically the current height of the blockchain, by repeating itself after a delay
    sia.connect('localhost:9980').then((siad) => { siad.call('/consensus').then((consensus) =>  {
        var consensusBlock = consensus.height
        consensusBlock = parseFloat(consensusBlock)

        saveStatusFile(consensusBlock, dbHeight)

        if (consensusBlock > dbHeight) {
            console.log("New highest block in the blockchain: " + consensusBlock)

            // B - If new blocks, determine blocks to remove (up to 4, for possible rearrangements). The 4 previous to consensusBlock (they might not exist on the DB, it is ok)
            var blocksToDelete = [(consensusBlock - 1), (consensusBlock - 2), (consensusBlock - 3), (consensusBlock - 4)]
            SqlFunctions.deleteBlocks(blocksToDelete)

            setTimeout(function() { // Delay of 5 seconds to allow it to delete blocks and avoid race conditions
                
                // C - Create the array of new blocks
                var blocksToIndex = []

                for (var n = 0; n < 4; n++) {
                    var checkingBlock = consensusBlock - 4 + n
                    if ((checkingBlock) <= dbHeight) { // Adding blocks that were removed
                        blocksToIndex.push(checkingBlock)
                    }
                }
                // Next I add the blocks from dbHeight to consensusBlock
                for (var m = (dbHeight + 1); m <= consensusBlock; m++) {
                    blocksToIndex.push(m)
                }

                // D - Reload the pools' database and call main function again
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
                    
                    blockRequest(blocksToIndex, poolsDb)
                })

            }, 5000);
        
        } else {
            // Repeat after a delay
            setTimeout(function() {
                consensusCheck(dbHeight) 
            }, consensusCheckTime);
        }

    })}).catch((err) => {console.error(err); console.log("//// Error on consensus call")}) // Errors of Sia Consensus call
}



function saveStatusFile(consensusBlock, lastBlockDb) {
    var now = new Date().valueOf()
    var statusArray = {
        "consensusblock": consensusBlock,
        "lastblock": lastBlockDb,
        "time": now
    }

    var stream = fs.createWriteStream("status.json")
    var string = JSON.stringify(statusArray)
    stream.write(string)
}

