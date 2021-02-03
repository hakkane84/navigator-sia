// Navigator-Sia: an advanced blockchain explorer for the Sia network
// Github: https://github.com/hakkane84/navigator-sia
// License: GNU AGPLv3
// Author: Salvador Herrera (keops_cc@outlook.com)

var fs = require('fs');
var stripJsonComments = require('strip-json-comments')

// Load configuration file
var rawFile = fs.readFileSync("config.json").toString()
var config = JSON.parse(stripJsonComments(rawFile))

// Loads all the parameters and functions, from the external params.js module
var Params = require('./modules/params.js')
var params = Params.Params(config, "./")

// Rest of scripts
var ExchangeRates = require('./modules/exchangerates.js')
var Commons = require('./modules/commons.js')
var SqlAsync = require('./modules/sql_async.js')
var Indexer = require("./modules/indexer.js")
var Mempool = require("./modules/mempool.js")
var SqlComposer = require("./modules/sql_composer.js")
var Restserver = require('./modules/restserver.js')
var Watchdog = require('./modules/watchdog.js')
var WebInjector = require("./modules/webinjector.js")
var Foundation = require("./modules/foundation.js")

// STARTING
var currentdate = new Date(); 
var datetime = currentdate.getDate() + "/"
    + (currentdate.getMonth()+1)  + "/" 
    + currentdate.getFullYear() + " - "  
    + currentdate.getHours() + ":"  
    + currentdate.getMinutes() + ":" 
    + currentdate.getSeconds();
console.log("======================================================")
console.log("                  STARTING NAVIGATOR")
console.log("======================================================")
console.log()
console.log("Logging started: " + datetime)

// Informing the user if Navigator is using a local Sia node or a network of Routers
if (params.useRouters == false) {
    console.log("* Navigator will use a local Sia instance in port 9980")
} else {
    console.log("* Navigator is using a network of " + params.siaRouters.length + " Routers")
}


// Script overview
// 0 - Assesing if the user is ordering a repair of the database
// 1 - Maintenance: a timeout and checking if the database tables exist. If not, create them
// 2 - On startup, find the blocks that need to be indexed
// 3 - Loop over the blocks to be indexed
// 4 - Save status files after each block
// 5 - Once done, enter on standby and check every 10 seconds to find if new blocks have been added
// 6 - Repeat from (3)


initialMaintenance()

async function initialMaintenance() {
    // Initial delay of 2 seconds to allow the database connection to be stablished
    await Commons.Delay(2000);

    // Initializing the REST API server
    Restserver.Restserver(params)

    // Check if the database tables exist, and if not create new tables
    await SqlAsync.CheckNavigatorTables(params)

    // Checking the existence of an exchanges rate database. Create one otherwise.
    // The initial indexing is done asynchronosuly, as it might conflict in SQL Server with the blockchain indexing
    if (params.useCoinGeckoPrices == true) {
        await SqlAsync.CheckExchangesDatabase(params)
    }

    // Injecting variables into the website files
    if (params.injectWebsiteOnStartup == true) {
        WebInjector.Injector(params)
    }

    // Checking if the user ordered a repair of blocks, and create a repair file if he did
    var repairFromBlock = parseInt(process.argv[2])
    if (repairFromBlock > 0) {
        var sqlQuery = SqlComposer.SelectTop(params, "BlockInfo", "Height", "Height", 1)
        var sql = await SqlAsync.Sql(params, sqlQuery)
        try {
            var blockEnd = sql[0].Height
        } catch (e) {
            var blockEnd = 0
        }
        
        if (blockEnd <= repairFromBlock) {
            console.log("*** Wrong repair argument. It needs to be a block height smaller than the current highest block indexed")
        } else {
            var repair = {
                blockStart: repairFromBlock,
                blockEnd: blockEnd
            }
            console.log("*** Database repair ordered from block " + repairFromBlock + " to " + blockEnd + ". Repair of blocks will take "
                + "place only while the blockchain indexer is iddle \n*** Repair will continue even after restarts \n*** To cancel it, "
                + "delete the file repair.json")
            
            // Saving the repair order as a JSON object
            fs.writeFileSync("repair.json", JSON.stringify(repair))
        }
        
    }

    // Initializing the Watchdog
    Watchdog.Watchdog(params, currentdate.getMinutes())

    // Next: Determine the blocks to index initially
    getBlocksToIndex(params.purgeBlocksOnStartup)
}

async function getBlocksToIndex(blocksToPurgeNum) {
    // Gets the blocks actually indexes, find gaps and creates an array of blocks to be indexed
    
    // A - Get current consensus height. Start with router number 0
    var api = await Commons.MegaRouter(params, 0, '/consensus')
    var currentHeight = parseInt(api.height)
    console.log("Current blockchain height: " + currentHeight)

    // B - Get the blocks already in the database
    var sqlQuery = "SELECT Height FROM BlockInfo ORDER BY Height DESC"
    var sqlBlocks = await SqlAsync.Sql(params, sqlQuery)
    try {
        console.log("Blocks in SQL database: " + sqlBlocks.length)
        
        // C - Purge the last purgeBlocksOnStartup (3 blocks by default). This is a security measure in case of blockchain reorgs or
        // a corrupted database due to incomplete indexing on a crash
        var blocksToPurge = []
        for (var i = 0; i < blocksToPurgeNum; i++) {
            blocksToPurge.push(parseInt(sqlBlocks[i].Height))
        }
        for (var i = 0; i < blocksToPurge.length; i++) {
            await Indexer.BlockDeleter(params, blocksToPurge[i])
        }

        // D - Find gaps in the sequence, and determine the blocks that remain to be indexed (including the purged blocks)
        var blocksToIndex = []
        var blockHeights = []
        for (var i = 0; i < sqlBlocks.length; i++) { // Getting only the block heights
            blockHeights.push(parseInt(sqlBlocks[i].Height))
        }
        blockHeights.sort(Commons.SortNumber) // Sort numerically the heights
        for (var i = 1; i < blockHeights.length; i++) { // Detecting gaps
            if (blockHeights[i] != (blockHeights[i-1] + 1)) { // Gap detected
                for (var j = (blockHeights[i-1] + 1); j < blockHeights[i]; j++) {
                    blocksToIndex.push(j)
                    console.log("Gap detected at height: " + j + " It will be repaired")
                }
            }
        }
        // Adding purged blocks
        blocksToPurge.sort(Commons.SortNumber) // Ordering blocks we purged
        blocksToIndex = blocksToIndex.concat(blocksToPurge)
        // Rest of the blocks up to the current height
        for (var i = (blocksToIndex[blocksToIndex.length-1] + 1); i <= currentHeight; i++) {
            blocksToIndex.push(i)
        }
        console.log("Intitial indexing of " + blocksToIndex.length + " blocks started:")

        // E - Initial status file update
        await statusFileFullUpdate(currentHeight, sqlBlocks[blocksToPurgeNum].Height)

    } catch (e) {
        // If no block on the database: Genesis indexing
        console.log("No blocks on the database. Indexing from Genesis")
        blocksToIndex = []
        for (var i = 0; i < currentHeight; i++) {
            blocksToIndex.push(i)
        }
        prevBlockMetadata = {}
        await statusFileFullUpdate(currentHeight, 0)
    }

    var startTimestamp = Math.floor(Date.now() / 1000)
    blockRequest(blocksToIndex, 0, startTimestamp) // Launches the indexer iterator
}


async function blockRequest(blocksToIndex, accumulatedQueries, tenBlocksTimestamp) {
    // Iterates over the list of blocksToIndex
    // A - Check if there are blocks remaining, and if the block is a Genesis block
    // B - /consensus/blocks call to the megarouter
    // C - Get the missing information about outputs and sending addresses, to make the info compatible with an explorer call
    // D - Indexing of transactions and metadata 
    // E - Resolved contracts
    // F - Saving used addresses & new balance of each address
    // G - Miner payout TX
    // H - Block info SQL queries
    // I - SQL insertion operations
    // J - Slice the indexed block from blocksToIndex and iterate next block

    try {
        // A - Check if there are blocks remaining
        if (blocksToIndex.length == 0) {
            preStandByForBlocks()
        
        } else {
            var blockStartTime = Math.floor(Date.now() / 1000)
            var block = blocksToIndex[0]

            // The main indexing operation is in this async function
            var sqlBatchLength = await Indexer.BlockIndexer(params, block)

            // J - Update heartbeat. As this is initial syncing, only every 10 blocks, to avoid too many unnecessary file opeprations
            if (block % 10 == 0) {
                // Check the consensus height
                var api = await Commons.MegaRouter(params, 0, '/consensus')
                var currentHeight = parseInt(api.height)
                
                // Update file
                await statusFileFullUpdate(currentHeight, block)

                // Check if we need to update the coin prices
                if (params.useCoinGeckoPrices == true) {
                    var date = new Date()
                    var hh = date.getHours()
                    var mm = date.getMinutes()
                    
                    if (hh == 0 && mm < 15) {
                        // Checking if it is already inserted on the database or not
                        var dayBegin = await ExchangeRates.DayBeginTime(date.getTime())
                        var sqlQuery = "SELECT Timestamp FROM ExchangeRates WHERE Timestamp=" + dayBegin
                        var sql = await SqlAsync.Sql(params, sqlQuery)
                        if (sql.length == 0 || sql == false) {
                            await ExchangeRates.DailyExchangeData(params)
                        } 
                    }
                }
            }

            // K - Indexing time, for logs
            var blockEndTime = Math.floor(Date.now() / 1000)
            if (blocksToIndex.length < 200) {
                // We are approaxing the current height, or this is regular stand-by indexing: show full stats
                var indexingTime = blockEndTime - blockStartTime
                if (indexingTime == 0) {indexingTime="<1"}
                accumulatedQueries = 0
                tenBlocksTimestamp = 0
                console.log("Block " + block + " indexed - " + sqlBatchLength + " queries in " + indexingTime + " sec")
            } else {
                // Initial indexing, just show progress every 10 blocks
                if (block % 10 == 0) {
                    var minusNineBlocks = block - 9
                    if (minusNineBlocks < 0) {minusNineBlocks = 0}
                    console.log("Blocks " + minusNineBlocks + " to " + block + " indexed - " + accumulatedQueries + " queries in " + (blockEndTime - tenBlocksTimestamp) + " sec")
                    accumulatedQueries = 0
                    tenBlocksTimestamp = blockEndTime // We reset the counter to the timestamp of this block
                } else {
                    accumulatedQueries = accumulatedQueries + sqlBatchLength

                    // To avoid the Watchdog to panic if this segment of 10 blocks is taking too long, if this block took more than 3 minutes (180 seconds),
                    // we update the heartbeat in the status file
                    if ((blockEndTime - blockStartTime) > 180) {
                        try {
                            var rawFile = fs.readFileSync("status.json")
                            var statusArray = JSON.parse(rawFile)
                            statusArray[0].heartbeat = new Date().valueOf()
                            fs.writeFileSync("status.json", JSON.stringify(statusArray))
                        } catch (e) {
                            // Error, we create a new file from scratch (takes a bit longer)
                            console.log("// Status file not found or corrupted. Creating a new one")
                            await statusFileFullUpdate(consensusHeight, sqlHeight)
                        }
                    }
                }
            }
            
            // L - Next block. We remove the first element of the array
            blocksToIndex.shift()
            blockRequest(blocksToIndex, accumulatedQueries, tenBlocksTimestamp)
        }
    } catch (e) {
        // Stops the script to allow a graceful restart by Forever/PM2 if something unexpected stopped the indexer. As the script runs also the API server and the
        // database connector, otherwise the script would keep running
        console.log(e)
        console.log("*** Forcing the stop of the script in 5 minutes")
        await Commons.Delay(300000); // Async timeout
        process.exit()
    }
}

async function preStandByForBlocks() {
    // Makes a full status file update after finishing the list of indexing blocks
    // It is the previous state to the stand-by mode
    var sqlQuery = SqlComposer.SelectTop(params, "BlockInfo", "Height", "Height", 1)
    var sql = await SqlAsync.Sql(params, sqlQuery)
    var sqlHeight = sql[0].Height
    var api = await Commons.MegaRouter(params, 0, '/consensus')
    var consensusHeight = parseInt(api.height)
    await statusFileFullUpdate(consensusHeight, sqlHeight)
    standByForBlocks(sqlHeight)
}

async function standByForBlocks(sqlHeight) {
    // Awaits for new blocks being added to the blockchain, checking every `params.consensusCheckTime` seconds. In the meantime, it can do some
    // maintenance tasks. It is a recursive function

    // A - Priority 1: Check if we are at the beginning of the day, and we need to index the coin prices
    // Checking the time of the day. We only assess the need of updating if it is 00:00 - 00:15
    if (params.useCoinGeckoPrices == true) {
        var date = new Date()
        var hh = date.getHours()
        var mm = date.getMinutes()
        
        if (hh == 0 && mm < 15) {
            // Checking if it is already inserted on the database or not
            var dayBegin = await ExchangeRates.DayBeginTime(date.getTime())
            var sqlQuery = "SELECT Timestamp FROM ExchangeRates WHERE Timestamp=" + dayBegin
            var sql = await SqlAsync.Sql(params, sqlQuery)
            if (sql.length == 0 || sql == false) {
                await ExchangeRates.DailyExchangeData(params)
            } 
        }
    }
    

    // B - Priority 2: Check for newly indexed blocks
    var api = await Commons.MegaRouter(params, 0, '/consensus')
    var consensusHeight = parseInt(api.height)
    if (consensusHeight > sqlHeight) {
        
        // Create the new bacth of blocks
        var blocksToIndex = []
        for (var i = (sqlHeight+1); i <= consensusHeight; i++) {
            blocksToIndex.push(i)
        }

        // Launch indexing. Previous to start indexing, we try to detect blockhain reorganizations, reindex changed 
        // blocks and keep track of the reorg
        checkReorgs(sqlHeight, blocksToIndex, [])
    
    } else {
        // C - Priority 3: Index a batch of 10 blocks from the repair order, if it exists
        var skipDelay = false
        try {
            var repairOrder = JSON.parse(fs.readFileSync("repair.json"))
            blocksToRepair = []
            for (var i = repairOrder.blockStart; (i < (repairOrder.blockStart+10) && i <= repairOrder.blockEnd); i++) {
                blocksToRepair.push(i)
            }
            console.log("*** Repairing the blocks segment: " + blocksToRepair[0] + " - " + blocksToRepair[blocksToRepair.length-1])
            
            // Sequential deletion and re-indexing
            for (var i = 0; i < blocksToRepair.length; i++) {
                await Indexer.BlockDeleter(params, blocksToRepair[i])
                var blockStartTime = Math.floor(Date.now() / 1000)
                await Indexer.BlockIndexer(params, blocksToRepair[i])
                var blockEndTime = Math.floor(Date.now() / 1000)
                console.log("Block " + blocksToRepair[i] + " reindexed in " + (blockEndTime - blockStartTime) + " sec")
            }
            
            // Updating the file, or deleting it if these were the last blocks
            repairOrder.blockStart = repairOrder.blockStart + 10
            if (repairOrder.blockStart <= repairOrder.blockEnd) {
                // Update file
                fs.writeFileSync("repair.json", JSON.stringify(repairOrder))
            } else {
                // Delete file
                fs.unlinkSync("repair.json")
                console.log("*** This is the last segment of the repair order!")
            }

            console.log() // Spacer
            skipDelay = true // We have spent time already in this repair. Check if there are new blocks to index
        } catch (e) {}


        // D - Status update and recursing stand-by routine after a timeout (skip it if we repaired a segment of 10 blocks)
        if (skipDelay == false) {
            await Commons.Delay(params.consensusCheckTime)
        }
        statusFilePartialUpdate(consensusHeight, sqlHeight)
        standByForBlocks(sqlHeight)
    }
}


async function statusFileFullUpdate(consensusHeight, sqlHeight) {
    // Fully updates all the fields of the status.json file. This API file informs about the health of Navigator
    // Executed after each indexed block in stand-by mode, or each 10 blocks during initial indexing

    // Peers number
    var api = await Commons.MegaRouter(params, 0, '/gateway')
    var peersNumber = 0
    for (var i = 0; i < api.peers.length; i++) {
        if (api.peers[i].inbound == false) {
            peersNumber++
        }
    }

    // Sia daemon version
    var api = await Commons.MegaRouter(params, 0, '/daemon/version')
    var version = api.version

    // Mempool (unconfirmed transactions)
    var mempoolSize = await Mempool.Index(params)

    // Total transactions indexed and coin supply
    var totalTxQuery = SqlComposer.SelectTop(params, "BlockInfo", "TransactionCount, TotalCoins", "Height", 1)
    var topBlock = await SqlAsync.Sql(params, totalTxQuery)
    if (topBlock.length == 0) {
        var transactionCount = 0
        var coinSupply = 0
    } else {
        var transactionCount = topBlock[0].TransactionCount
        var coinSupply = Math.round(topBlock[0].TotalCoins / params.blockchain.coinPrecision)
    }
    
    // Building and saving array
    var statusArray = [{
        "consensusblock": consensusHeight,
        "lastblock": sqlHeight,
        "mempool": mempoolSize,
        "coinsupply": coinSupply,
        "totalTx": transactionCount,
        "heartbeat": new Date().valueOf(),
        "peers": peersNumber,
        "version": version
    }]
    fs.writeFileSync("status.json", JSON.stringify(statusArray))

    // Update the landing page API. Can be done synchronously safely
    landingApi(params)
}


async function statusFilePartialUpdate(consensusHeight, sqlHeight) {
    // Updates only the block heights and heartbeat timestamp of the status.json file.
    // This API file informs about the health of Navigator. Also the mempool size
    try {
        var rawFile = fs.readFileSync("status.json")
        var statusArray = JSON.parse(rawFile)
        statusArray[0].consensusblock = consensusHeight
        statusArray[0].lastblock = sqlHeight
        statusArray[0].heartbeat = new Date().valueOf()
        statusArray[0].mempool = await Mempool.Index(params)
        fs.writeFileSync("status.json", JSON.stringify(statusArray))
        
    } catch (e) {
        // Error, we create a new file from scratch (takes a bit longer)
        console.log("// Status file not found or corrupted. Creating a new one")
        await statusFileFullUpdate(consensusHeight, sqlHeight)
    }
}


async function landingApi(params) {
    // Collects latest items indexed: ScTx, file contracts, others and blocks
    var last10ScTx = SqlComposer.SelectTopWhere(params, "BlockTransactions", "Height,TxHash", "Height", 10,
        "TxType='ScTx'")
    var last10Contracts = SqlComposer.SelectTopWhere(params, "BlockTransactions", "Height,TxHash,TxType", "Height", 10,
        "TxType='contract' OR TxType='revison' OR TxType='storageproof' OR TxType='contractresol'")
    var last10Others = SqlComposer.SelectTopWhere(params, "BlockTransactions", "Height,TxHash,TxType", "Height", 10,
        "TxType='SfTx' OR TxType='host ann' OR TxType='blockreward'")
    var last10Blocks = SqlComposer.SelectTop(params, "BlockInfo", "Height,MiningPool,Timestamp", "Height", 10)

    var api = {
        last10ScTx: await SqlAsync.Sql(params, last10ScTx),
        last10Contracts: await SqlAsync.Sql(params, last10Contracts),
        last10Others: await SqlAsync.Sql(params, last10Others),
        last10Blocks: await SqlAsync.Sql(params, last10Blocks)
    }

    // Saving API
    fs.writeFileSync("landingpagedata.json", JSON.stringify(api))
}


async function checkReorgs(sqlHeight, blocksToIndex, blocksOrphaned) {
    // Recursive function that checks sequentially blocks that have been reorganized and keeps track of the reorg
    // We define that a block has been replaced if either a) the hash or b) the number of transactions do not match
    var sqlQuery = "SELECT Height, Hash, MinerPayoutAddress, MiningPool, NewTx FROM BlockInfo WHERE Height=" + sqlHeight
    var sql = await SqlAsync.Sql(params, sqlQuery)
    var indexedBlock = sql[0]
    var apiConsensus = await Commons.MegaRouter(params, 0, '/consensus/blocks?height=' + sqlHeight)

    // Checking discrepancies
    if (indexedBlock.NewTx =! apiConsensus.transactions.length || indexedBlock.Hash != apiConsensus.id) {
        // The block was replaced, save the data on blocksOrphaned, go one block back, delete the block, add the block to the list
        // to index and repeat this function

        // Determining the new mining pool
        // Mining pool name
        var miningPool = "Unknown" // Default 
        for (var a = 0; a < params.poolsDb.length; a++) { // For each pool
            for (var b = 0; b < params.poolsDb[a].addresses.length; b++) { // For each address
                if (apiConsensus.minerpayouts[0].unlockhash == params.poolsDb[a].addresses[b]) {
                    miningPool = params.poolsDb[a].name
                    b = params.poolsDb[a].addresses.length // Finishes the loop faster
                }
            }
            if (miningPool != "Unknown") {
                a = params.poolsDb.length // Finishes the loop faster
            }
        }

        // Saving data on blocksOrphaned
        blocksOrphaned.push({
            height: sqlHeight,
            hash: indexedBlock.Hash,
            miningPool: indexedBlock.MiningPool,
            miningAddress: indexedBlock.MinerPayoutAddress,
            replacingHash: apiConsensus.id,
            replacingPool: miningPool,
            replacingMiningAddress: apiConsensus.minerpayouts[0].unlockhash
        })

        // Deleting block and adding it to the list to index
        console.log("* Blockchain reorganization detected for block " + sqlHeight + ". Deleting...")
        await Indexer.BlockDeleter(params, sqlHeight)
        blocksToIndex.unshift(sqlHeight)

        // Repeat on the previousu block until there is concordance between SQL and Sia
        sqlHeight = sqlHeight - 1
        checkReorgs(sqlHeight, blocksToIndex, blocksOrphaned)

    } else {
        // Finished. If blocksOrphaned > 0 save the event. Move to indexing
        if (blocksOrphaned.length > 0) {
            await saveOrphanedBlocks(blocksOrphaned)
        }

        // Prior to request new block, we check if the addresses of the Sia Foundation have changed
        await Foundation.CheckCurrentFoundationAddresses(params)

        var startTimestamp = Math.floor(Date.now() / 1000)
        blockRequest(blocksToIndex, 0, startTimestamp)
    }
}

async function saveOrphanedBlocks(blocksOrphaned) {
    // Saves the events of the reorganization on the SQL database

    // A - Detecting the last orphaning event, to assign a new number
    var sqlQuery = SqlComposer.SelectTop(params, "Reorgs", "ReorgEventNum", "ReorgEventNum", 1)
    var sql = await SqlAsync.Sql(params, sqlQuery)
    if (sql.length == 0) {
        var reorgEventNum = 1
    } else {
        var reorgEventNum = sql[0].ReorgEventNum + 1
    }

    console.log("*** Recording blockchain reorg #" + reorgEventNum + " affecting " + blocksOrphaned.length + " blocks")

    for (var i = 0; i < blocksOrphaned.length; i++) {
        var sqlInsertion = SqlComposer.InsertReorg(params, blocksOrphaned[i], reorgEventNum)
        await SqlAsync.Sql(params, sqlInsertion)
    }
}

