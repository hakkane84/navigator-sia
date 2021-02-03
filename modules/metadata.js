// Calculates the metadata fields of blocks
var exports = module.exports={}
var SqlAsync = require('./sql_async.js')
var SqlComposer = require("./sql_composer.js")

exports.MetadataBlock = async function(params, api) {
    // Calculates the actual metadata of regular blocks

    // Get the metadata of the previous block
    var sqlQuery = "SELECT TransactionCount, Difficulty, Hashrate, TotalCoins, SiacoinInputCount, SiacoinOutputCount, FileContractRevisionCount,"
        + " StorageProofCount, SiafundInputCount, SiafundOutputCount, ActiveContractCost, ActiveContractCount, ActiveContractSize,"
        + " TotalContractCost, TotalContractCount, TotalContractSize, FeeCount, FeeCountHastings"
        + " FROM BlockInfo WHERE Height = " + (api.height-1)
    var result = await SqlAsync.Sql(params, sqlQuery)

    if (result.length == 0) {
        // This means that the previous block in the series is not found. This should only happen during debug operations. It will break
        // the metadata series, but allow the debugging. We instead take the metadata from the highest block in our database
        console.log("\n////// Metadata for block " + (api.height-1) + " was not found in the database")
        console.log("////// WARNING: the metadata series might be broken starting on block " + api.height)
        var sqlQuery = await SqlComposer.SelectTop(params, "BlockInfo", "*", "Height", 1)
        var result = await SqlAsync.Sql(params, sqlQuery)
        console.log("////// Using instead the metadata from block " + result[0].Height + "\n")
    }

    var prevBlock = result[0]

    try {
        var prevFeeCount = BigInt(prevBlock.FeeCountHastings)
    } catch (e) {
        var prevFeeCount = BigInt(prevBlock.FeeCount * 1000000000000000000000000)
    }

    var metadata = {
        Difficulty: parseInt(api.difficulty),
        Hashrate: 0,
        TransactionCount: parseInt(prevBlock.TransactionCount),
        TotalCoins: BigInt(prevBlock.TotalCoins) + blockReward(params, api.height) + foundationSubsidies(params, api.height),
        SiacoinInputCount: parseInt(prevBlock.SiacoinInputCount),
        SiacoinOutputCount: parseInt(prevBlock.SiacoinOutputCount),
        FileContractRevisionCount: parseInt(prevBlock.FileContractRevisionCount),
        StorageProofCount: parseInt(prevBlock.StorageProofCount),
        SiafundInputCount: parseInt(prevBlock.SiafundInputCount), // CHECK
        SiafundOutputCount: parseInt(prevBlock.SiafundOutputCount), // CHECK
        ActiveContractCost: BigInt(0),
        ActiveContractCount: 0,
        ActiveContractSize: BigInt(0),
        TotalContractCost: BigInt(prevBlock.TotalContractCost),
        TotalContractCount: parseInt(prevBlock.TotalContractCount),
        TotalContractSize: BigInt(prevBlock.TotalContractSize),
        FeeCountHastings: prevFeeCount + newFees(params, api),
        NewTx: 0,
        NewContracts: 0
    }
    // Adding the Fee count noted in SC, for code compatibility
    metadata.FeeCount = Math.round(Number(metadata.FeeCountHastings) / 1000000000000000000000000)

    // Transactions iterator
    for (var i = 0; i < api.transactions.length; i++) {
        metadata.SiacoinOutputCount = metadata.SiacoinOutputCount + api.transactions[i].siacoinoutputs.length
        metadata.SiacoinInputCount = metadata.SiacoinInputCount + api.transactions[i].siacoininputs.length
        metadata.SiafundOutputCount = metadata.SiafundOutputCount + api.transactions[i].siafundoutputs.length
        metadata.SiafundInputCount = metadata.SiafundInputCount + api.transactions[i].siafundinputs.length // To be done
        if (api.transactions[i].filecontractrevisions.length != 0) {
            metadata.FileContractRevisionCount++

            // Increasing the contract size with the revision: we need to know the original size of the contract and remove it
            var newSize = api.transactions[i].filecontractrevisions[0].newfilesize
            var contractId = api.transactions[i].filecontractrevisions[0].parentid
            var result = await SqlAsync.Sql(params, "SELECT OriginalFileSize FROM ContractInfo WHERE ContractId='" + contractId + "'")
            if (result != false) {
                var oldSize = result[0].OriginalFileSize
            } else {
                oldSize = 0
            }
            metadata.TotalContractSize = BigInt(metadata.TotalContractSize) + BigInt(newSize - oldSize)
        }
        if (api.transactions[i].storageproofs.length != 0) {metadata.StorageProofCount++}
        if (api.transactions[i].filecontracts.length != 0) {
            metadata.NewContracts++
            metadata.TotalContractCount++
            metadata.TotalContractCost = BigInt(metadata.TotalContractCost) + BigInt(api.transactions[i].filecontracts[0].payout)
            metadata.TotalContractSize = BigInt(metadata.TotalContractSize) + BigInt(api.transactions[i].filecontracts[0].filesize)
        }
        metadata.TransactionCount++
        metadata.NewTx++
    }

    // Metadata from active contracts
    metadata = await activeContractsMetadata(params, metadata, api.height)

    // Hashrate estimation
    metadata.Hashrate = await hashrateEstimation(params, api.height, api.timestamp, api.difficulty)

    return metadata
}

function blockReward(params, height) {
    // Calculates the block reward - Mined coins
    var decay = (BigInt(height) * params.blockchain.decayBlockReward)
    var reward = params.blockchain.initialBlockReward - decay
    if (reward < params.blockchain.endBlockReward) {
        reward = params.blockchain.endBlockReward
    }

    return reward   
}

function foundationSubsidies(params, height) {
    // Calculates the foundation subsidies
    var reward = BigInt(0)

    // Initial Foundation subsidy
    if (height == params.blockchain.foundationForkHeight) {
        reward = reward + params.blockchain.foundationInitialSubsidy
    }

    // Monthly Foundation subsidy
    if (height > params.blockchain.foundationForkHeight) {
        if ((height - params.blockchain.foundationForkHeight) % params.blockchain.foundationSubsidyPeriodicity == 0) {
            reward = reward + params.blockchain.foundationSubsidy
        }
    }

    return reward
}

function newFees(params, api) {
    // Fees collected on this block. The block payouts minus the block reward
    var reward = blockReward(params, api.height)
    var minersCollected = BigInt(0)
    for (var i = 0; i < api.minerpayouts.length; i++) {
        minersCollected = minersCollected + BigInt(api.minerpayouts[i].value)
    }
    return minersCollected - reward
}

async function activeContractsMetadata(params, metadata, height) {
    // Metadata from active contracts
    var sqlQuery = "SELECT CurrentFileSize, ValidProof1Value, ValidProof2Value FROM ContractInfo WHERE Height<=" + height 
        + " AND WindowEnd>" + height
    var contracts = await SqlAsync.Sql(params, sqlQuery)
    metadata.ActiveContractCount = metadata.ActiveContractCount + contracts.length
    for (var i = 0; i < contracts.length; i++) {
        metadata.ActiveContractSize = metadata.ActiveContractSize + BigInt(contracts[i].CurrentFileSize)
        // Contract cost: the outputs value + the SF fees. To deal with bigints, I multiply 1.039 by 1000 and then divide
        // by 1000 again
        metadata.ActiveContractCost = metadata.ActiveContractCost + (BigInt(contracts[i].ValidProof1Value) 
            + BigInt(contracts[i].ValidProof2Value)) * BigInt((1 + params.blockchain.siafundFees) * 1000) / 1000n
    }
    return metadata
}

async function hashrateEstimation(params, height, timestamp, currentDifficulty) {
    // Estimates the network hashrate using the same algorithm used by the defunct and deprecated Sia Explorer
    // module. Algorithm reproduced here to keep the data consistency of SiaStats
    // Collecting the Difficulties of the previous blocks (default: 199 + the current block)
    var sqlQuery = "SELECT Difficulty, Timestamp FROM BlockInfo WHERE Height>" + (height - params.blockchain.hashrateEstimationBlocks) 
        + " AND Height<=" + (height - 1) + " ORDER BY Timestamp ASC"
    var difficultiesArray = await SqlAsync.Sql(params, sqlQuery)
    var sumDifficulty = parseInt(currentDifficulty)
    for (var i = 0; i < difficultiesArray.length; i++) {
        sumDifficulty = sumDifficulty + difficultiesArray[i].Difficulty
    }
    try {
        var elapsedSeconds = timestamp - difficultiesArray[0].Timestamp
        var hashrate = Math.round(sumDifficulty / elapsedSeconds)
    } catch {
        // During debugging, we might not have collected previous blocks, so we just set hashrate as 0
        var hashrate = 0
    }
    
    return hashrate
}


exports.MetadataGenesis = async function(params, api) {
    // Calculates the actual metadata of the genesis block
    var metadata = {
        Difficulty: params.blockchain.genesisDifficulty,
        Hashrate: params.blockchain.genesisHashrate,
        TransactionCount: 0,
        TotalCoins: params.blockchain.initialBlockReward,
        SiacoinInputCount: 0,
        SiacoinOutputCount: 0,
        FileContractRevisionCount: 0,
        StorageProofCount: 0,
        SiafundInputCount: 0,
        SiafundOutputCount: 0,
        ActiveContractCost: 0,
        ActiveContractCount: 0,
        ActiveContractSize: 0,
        TotalContractCost: 0,
        TotalContractCount: 0,
        TotalContractSize: 0,
        FeeCount: 0,
        FeeCountHastings: 0,
        NewTx: 0,
        NewContracts: 0
    }
    for (var i = 0; i < api.transactions.length; i++) {
        metadata.SiacoinOutputCount = metadata.SiacoinOutputCount + api.transactions[i].siacoinoutputs.length
        metadata.SiafundOutputCount = metadata.SiafundOutputCount + api.transactions[i].siafundoutputs.length
        metadata.TransactionCount++
        metadata.NewTx++
    }
    return metadata
}


exports.AddMetadataToQuery = async function(params, metadata, sqlBatch, height, timestamp, blockId, minerPayoutAddress, minerArbitraryData, miningPool) {
    // Adds the metadata to the bacth of SQL queries

    var toAddBlockInfo = "(" + height + "," + timestamp + "," + metadata.TransactionCount + ",'" + blockId + "','" + minerPayoutAddress + "','"
        + minerArbitraryData + "'," +  BigInt(metadata.Difficulty) + "," +  BigInt(metadata.Hashrate) + "," + BigInt(metadata.TotalCoins) + ","
        + parseInt(metadata.SiacoinInputCount) + "," + parseInt(metadata.SiacoinOutputCount) + "," + parseInt(metadata.FileContractRevisionCount) + "," 
        + parseInt(metadata.StorageProofCount) + "," + parseInt(metadata.SiafundInputCount) + "," + parseInt(metadata.SiafundOutputCount) + "," 
        + BigInt(metadata.ActiveContractCost) + "," + parseInt(metadata.ActiveContractCount) + "," + BigInt(metadata.ActiveContractSize) + "," 
        + parseInt(metadata.TotalContractCost) + "," + parseInt(metadata.TotalContractCount) + "," + BigInt(metadata.TotalContractSize) + "," 
        + metadata.NewContracts + "," + metadata.NewTx + ",'" + miningPool + "'," + BigInt(metadata.FeeCount) + "," + metadata.FeeCountHastings + ")"
    sqlBatch.push(SqlComposer.InsertSql(params, "BlockInfo", toAddBlockInfo, height));

    // Block as a hash type
    var toAddHashTypes = "('" + blockId + "','block'," + height + ")"
    sqlBatch.push(SqlComposer.InsertSql(params, "HashTypes", toAddHashTypes, blockId))
    var toAddHashTypes2 = "('" + height + "','block'," + height + ")"
    sqlBatch.push(SqlComposer.InsertSql(params, "HashTypes", toAddHashTypes2, height))

    return sqlBatch
}
