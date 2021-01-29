// Processes the info of a block to be indexed. This is the routine inside the main loop of the program
// It also contains the routine to delete blocks
var exports = module.exports={}
var fs = require('fs')
var Commons = require('./commons.js')
var Addresses = require("./addresses.js")
var Genesis = require("./genesis.js")
var Metadata = require("./metadata.js")
var Outputs = require("./outputs.js")
var Siafunds = require('./siafunds.js')
var Siacoins = require('./siacoins.js')
var FileContracts = require('./filecontracts.js')
var ParentFinder = require("./parentfinder.js")
var Metadata = require("./metadata.js")
var SqlAsync = require('./sql_async.js')
var SqlComposer = require("./sql_composer.js")

exports.BlockIndexer = async function(params, block) {
    // B - /consensus/blocks call to the megarouter
    var apiConsensus = await Commons.MegaRouter(params, 0, '/consensus/blocks?height=' + block)

    // C1 - Get the missing information about outputs and sending addresses. This enriches the API
    var api = await ParentFinder.ParentFinder(params, apiConsensus)
    
    // Debug lines for saving the outputs of the Explorer API and the Consensus API (after being completed by parentfinder.js)
    // Keep them in comments unless debugging
    //var apiExplorer = await Commons.MegaRouter(params, 0, '/explorer/blocks/' + block)
    //fs.writeFileSync("explorer_test.json", JSON.stringify(apiExplorer))
    //fs.writeFileSync("consensus_rich_test.json", JSON.stringify(api))


    var height = block
    var timestamp = api.timestamp
    var blockId = api.id

    if (block == 0) {
        // Genesis block
        var sqlBatch = await Genesis.GenesisIndexing(params, api)
        var metadata = await Metadata.MetadataGenesis(params, api)
        var minerPayoutAddress = "Genesis block"
        var minerArbitraryData = ""
        var miningPool = ""

    } else {
        // D - Actual indexing
        var minerArbitraryData = ""
        var sqlBatch = [] // Saves all the sql insert requests, to later add them in a single connection, or administer it as a queue
        var txsIndexed = [] // Collects all the TXs number already indexed
        var addressesImplicated = [] // Collects every change in the balance of addresses

        // D0 - Block Metadata
        var metadata = await Metadata.MetadataBlock(params, api)

        // D1 - Outputs
        sqlBatch = await Outputs.Outputs(params, api, sqlBatch)

        for (var i = 0; i < api.transactions.length; i++) { // For each Tx
            // D2 - SC Transactions
            // They get identified as containing siacoininputs, paying miner fees, and negative for siafunds, contracts, revisions and proofs
            if (api.transactions[i].siacoininputs.length != 0
                && api.transactions[i].minerfees.length != 0
                && api.transactions[i].filecontracts.length == 0
                && api.transactions[i].filecontractrevisions.length == 0
                && api.transactions[i].storageproofs.length == 0
                && api.transactions[i].siafundinputs.length == 0
                && api.transactions[i].siafundoutputs.length == 0
            ) {
                var returnArray = await Siacoins.scTransactionProcess(params, api, i, height, timestamp)
                sqlBatch = sqlBatch.concat(returnArray[0])
                txsIndexed = txsIndexed.concat(returnArray[1])
                addressesImplicated = addressesImplicated.concat(returnArray[2])
            }

            // D3 - SF Transactions. First condition detects that the TX is SF involved. Second condition the receiver TX
            if (api.transactions[i].rawtransaction.siafundinputs.length != 0 && api.transactions[i].rawtransaction.siacoininputs.length != 0) {
                var returnArray = await Siafunds.sfTransactionProcess(params, api, i, height, timestamp, metadata.TotalContractCost)
                sqlBatch = sqlBatch.concat(returnArray[0])
                txsIndexed = txsIndexed.concat(returnArray[1])
                addressesImplicated = addressesImplicated.concat(returnArray[2])
            }

            /// D4.1 - File contract atomic renewals
            if (api.transactions[i].filecontracts.length != 0 && api.transactions[i].filecontractrevisions.length != 0) {
                var returnArray = await FileContracts.atomicRenewalProcess(params, api, i, height, timestamp)
                sqlBatch = sqlBatch.concat(returnArray[0])
                txsIndexed = txsIndexed.concat(returnArray[1])
                addressesImplicated = addressesImplicated.concat(returnArray[2])
            }

            // D4.2 - File contracts
            if (api.transactions[i].filecontracts.length != 0 && api.transactions[i].filecontractrevisions.length == 0) {
                var returnArray = await FileContracts.fileContractsProcess(params, api, i, height, timestamp)
                sqlBatch = sqlBatch.concat(returnArray[0])
                txsIndexed = txsIndexed.concat(returnArray[1])
                addressesImplicated = addressesImplicated.concat(returnArray[2])
            }

            // D5 - Contract revisions
            if (api.transactions[i].filecontractrevisions.length != 0 && api.transactions[i].filecontracts.length == 0) {
                var returnArray = await FileContracts.revisionProcess(params, api, i, height, timestamp)
                sqlBatch = sqlBatch.concat(returnArray[0])
                txsIndexed = txsIndexed.concat(returnArray[1])
                addressesImplicated = addressesImplicated.concat(returnArray[2])
            }

            // D6 - Proofs of storage
            if (api.transactions[i].storageproofs.length != 0) {
                var returnArray = await FileContracts.proofProcess(params, api, i, height, timestamp)
                sqlBatch = sqlBatch.concat(returnArray[0])
                txsIndexed = txsIndexed.concat(returnArray[1])
                addressesImplicated = addressesImplicated.concat(returnArray[2])
            }

            // D7 - Mining pool empty transactions including their arbitrary data
            // Some pools add this TX as the first in the block, some others, as the last. In both cases, it is an empty TX
            if (api.transactions[i].siacoininputs.length == 0
                && api.transactions[i].siacoinoutputs.length == 0
                && api.transactions[i].minerfees.length == 0
                && api.transactions[i].filecontracts.length == 0
                && api.transactions[i].filecontractrevisions.length == 0
                && api.transactions[i].storageproofs.length == 0
                && api.transactions[i].siafundinputs.length == 0
                && api.transactions[i].siafundoutputs.length == 0
                && api.transactions[i].arbitrarydata.length > 0
            ) {
                var arbitraryData = api.transactions[i].arbitrarydata[0]
                var slice = arbitraryData.slice(0,14)
                if (slice != "SG9zdEFubm91bm") { // Otherwise, it would just be a legacy host announcement
                    minerArbitraryData = arbitraryData
                } else {
                    // D8 - Legacy host announcements
                    sqlBatch = await Siacoins.legacyHostAnnouncements(params, api, i, height, timestamp, sqlBatch)
                }
                txsIndexed.push(i) // Marking this TX as indexed in both cases
            }
        }

        // D9 - Exceptional transactions not paying mining fees (legacy transactions and certain misconfigured pools)
        // We revise the transactions not included yet on the txsIndexed array. We will include these TXs as singlets, rather than the
        // duets that Navigator usually merge
        for (var i = 0; i < api.transactions.length; i++) { 
            var thisTxAlreadyIndexed = false
            for (var j = 0; j < txsIndexed.length; j++) { // Check every tx already indexed
                if (i == txsIndexed[j]) { // A match
                    thisTxAlreadyIndexed = true
                }
            }
            // D9a - SC singlets
            if (thisTxAlreadyIndexed == false && api.transactions[i].siacoinoutputs.length != 0) {
                var returnArray = await Siacoins.scSingleTransaction(params, api, i, height, timestamp)
                sqlBatch = sqlBatch.concat(returnArray[0])
                addressesImplicated = addressesImplicated.concat(returnArray[1])
            }
            // D9b - SF singlets
            if (thisTxAlreadyIndexed == false && api.transactions[i].siafundoutputs.length != 0) {
                var returnArray = await Siafunds.sfSingleTransaction(params, api, i, height, timestamp, metadata.TotalContractCost)
                sqlBatch = sqlBatch.concat(returnArray[0])
                addressesImplicated = addressesImplicated.concat(returnArray[1])
            }
        }

        // E - Contract resolutions
        var returnArray = await FileContracts.contractResolutions(params, height, timestamp)
        sqlBatch = sqlBatch.concat(returnArray[0])
        addressesImplicated = addressesImplicated.concat(returnArray[1])

        // F - Miner payout TX
        var returnArray = await minerPayoutProcessor(params, sqlBatch, addressesImplicated, height, timestamp, api)
        sqlBatch = returnArray[0]
        addressesImplicated = returnArray[1]
        minerPayoutAddress = returnArray[2]
        miningPool = returnArray[3]

        // G - Saving used addresses and update the balance of each one
        sqlBatch = await Addresses.Addresses(params, sqlBatch, addressesImplicated, height, timestamp)
    }

    // H - Block info SQL queries: metadata and block as a hash type
    sqlBatch = await Metadata.AddMetadataToQuery(params, metadata, sqlBatch, height, timestamp, blockId, minerPayoutAddress, minerArbitraryData, miningPool)
    var toAddHashTypes = "('" + api.id + "','block'," + height + ")"
    sqlBatch.push(SqlComposer.InsertSql(params, "HashTypes", toAddHashTypes, api.id))
    var toAddHashTypes2 = "('" + height + "','block'," + height + ")"
    sqlBatch.push(SqlComposer.InsertSql(params, "HashTypes", toAddHashTypes2, height))

    // I - SQL insertion
    await SqlAsync.BacthInsert(params, sqlBatch, height, true)

    return sqlBatch.length
}


async function minerPayoutProcessor(params, sqlBatch, addressesImplicated, height, timestamp, api) {
    // Processes the payout of a mining pool and assigns a block to a pool
    var payoutAddress = api.minerpayouts[0].unlockhash

    // The transaction ID of a miner payout is the hash of the block, however, this would conflict in Navigator's SQL
    // database. Instead, I create an artificial TxID where I replace the first two characters of the block hash by
    // a "BR" (block reward)
    var minerPayoutTxId = "BR" + api.id.slice(2)
    
    // Address change. Add it to the Addresses Implicated array
    addressesImplicated.push({
        hash: payoutAddress, 
        masterHash: minerPayoutTxId,
        sc: parseInt(api.minerpayouts[0].value),
        sf: 0,
        txType: 'blockreward'
    })

    // Tx info
    var toAddTxInfo = "('" + minerPayoutTxId + "',''," + height + "," + timestamp + ",null)"
    sqlBatch.push(SqlComposer.InsertSql(params, "TxInfo", toAddTxInfo, minerPayoutTxId))

    // Saving TX as a component of a block
    var toAddBlockTransactions = "(" + height + ",'" + minerPayoutTxId + "','blockreward'," + parseInt(api.minerpayouts[0].value) + ",0)"
    sqlBatch.push(SqlComposer.InsertSql(params, "BlockTransactions", toAddBlockTransactions, minerPayoutTxId))

    // Miner payout as hash type
    var toAddHashTypes = "('" + minerPayoutTxId + "','blockreward','')"
    sqlBatch.push(SqlComposer.InsertSql(params, "HashTypes", toAddHashTypes, minerPayoutTxId))
    
    // Add the new output
    sqlBatch = await Outputs.MiningPoolPayoutOutput(params, sqlBatch, api, height, payoutAddress)
    
    // Mining pool name
    var miningPool = "Unknown" // Default 
    for (var a = 0; a < params.poolsDb.length; a++) { // For each pool
        for (var b = 0; b < params.poolsDb[a].addresses.length; b++) { // For each address
            if (payoutAddress == params.poolsDb[a].addresses[b]) {
                miningPool = params.poolsDb[a].name
                b = params.poolsDb[a].addresses.length // Finishes the loop faster
            }
        }
        if (miningPool != "Unknown") {
            a = params.poolsDb.length // Finishes the loop faster
        }
    }

    // Return array:
    var returnArray = [
        sqlBatch,
        addressesImplicated,
        payoutAddress,
        miningPool
    ]
    return returnArray
}


exports.BlockDeleter = async function(params, height) {
    try {
        // Deletes all the data from a block on the SQL database
        console.log("Deleting block: " + height)

        // A - Retrieve balance changes (This first, as next we will delete these entries)
        var sqlQuery = "SELECT Address, ScChange, SfChange FROM AddressChanges WHERE Height=" + height
        var changes = await SqlAsync.Sql(params, sqlQuery)
        if (changes == undefined) { // Error on SQL
            changes = []
        }

        // B - Delete block contents
        var sqlBatch = [
            "DELETE FROM AddressChanges WHERE Height=" + height,
            "DELETE FROM BlockInfo WHERE Height=" + height,
            "DELETE FROM BlockTransactions WHERE Height=" + height,
            "DELETE FROM TxInfo WHERE Height=" + height,
            "DELETE FROM HostAnnInfo WHERE Height=" + height,
            "DELETE FROM ContractInfo WHERE Height=" + height,
            "DELETE FROM RevisionsInfo WHERE Height=" + height,
            "DELETE FROM StorageProofsInfo WHERE Height=" + height,
            "DELETE FROM ContractResolutions WHERE Height=" + height
        ]

        // C - Outputs: those spent has to be unspent
        // Those that were inserted as spent on the same block
        sqlBatch.push("DELETE FROM Outputs WHERE CreatedOnBlock=" + height + " AND SpentOnBlock=" + height)
        // Those unknown when were created (missing parent, made by potential bugs)
        sqlBatch.push("DELETE FROM Outputs WHERE CreatedOnBlock IS NULL AND SpentOnBlock=" + height)
        // Those unspent get deleted.
        sqlBatch.push("DELETE FROM Outputs WHERE CreatedOnBlock=" + height + " AND Spent IS NULL")
        sqlBatch.push("UPDATE Outputs SET Spent=NULL, SpentOnBlock=null WHERE SpentOnBlock=" + height)
    
        
        // D - Update current balances
        // Adapt "changes" to the addressesImplicated format
        var addressesImplicated = []
        for (var i = 0; i < changes.length; i++) {
            addressesImplicated.push({
                hash: changes[i].Address,
                sc: changes[i].ScChange,
                sf: changes[i].SfChange
            })
        }
        sqlBatch = await Addresses.Balances(params, sqlBatch, addressesImplicated, true)

        // E - Revert Contracts resolved this block to "ongoing"
        sqlBatch.push("UPDATE ContractInfo SET Status='ongoing' WHERE WindowEnd=" + height)

        // F - Execute batched queries
        await SqlAsync.BacthInsert(params, sqlBatch, height, false)
        return

    } catch (e) {
        // Stops the script to allow a graceful restart by Forever/PM2 if something unexpected stopped the deleter
        console.log(e)
        console.log("*** Forcing the stop of the script in 5 minutes")
        await Commons.Delay(300000); // Async timeout
        process.exit()
    }
}
