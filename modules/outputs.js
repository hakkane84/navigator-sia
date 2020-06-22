// Saves outputs information on the database
var exports = module.exports={}
var SqlComposer = require("./sql_composer.js")
var Commons = require('./commons.js')

exports.Outputs = async function(params, api, sqlBatch) {
    // Creates SQL entries for newly created outputs and updates the spent outputs

    // Iterating transactions
    var newOutputs = []
    var spentOutputs = []
    var newSfOutputs = []
    var spentSfOutputs = []
    for (var i = 0; i < api.transactions.length; i++) {
        // A - New outputs
        if (api.transactions[i].siacoinoutputs != null && api.transactions[i].siacoinoutputs != []) {
            for (var j = 0; j < api.transactions[i].siacoinoutputs.length; j++) {
                var outputId = api.transactions[i].siacoinoutputs[j].id
                var value = api.transactions[i].siacoinoutputs[j].value
                var address = api.transactions[i].siacoinoutputs[j].unlockhash
                newOutputs.push({
                    outputId: outputId,
                    value: value,
                    address: address
                })
            }
        }
        // SFs
        if (api.transactions[i].siafundoutputs != null && api.transactions[i].siafundoutputs != []) {
            for (var j = 0; j < api.transactions[i].siafundoutputs.length; j++) {
                var outputId = api.transactions[i].siafundoutputs[j].id
                var value = api.transactions[i].siafundoutputs[j].value
                var address = api.transactions[i].siafundoutputs[j].unlockhash
                newSfOutputs.push({
                    outputId: outputId,
                    value: value,
                    address: address
                })
            }
        }


        // B - Update spent outputs
        if (api.transactions[i].siacoininputoutputs != null && api.transactions[i].siacoininputoutputs != []) {
            for (var j = 0; j < api.transactions[i].siacoininputoutputs.length; j++) {
                var outputId = api.transactions[i].siacoininputoutputs[j].id
                if (outputId != "unknown output") {
                    spentOutputs.push(outputId)
                }
                
            }
        }
        // SFs
        if (api.transactions[i].siafundinputoutputs != null && api.transactions[i].siafundinputoutputs != []) {
            for (var j = 0; j < api.transactions[i].siafundinputoutputs.length; j++) {
                var outputId = api.transactions[i].siafundinputoutputs[j].id
                if (outputId != "unknown output") {
                    spentSfOutputs.push(outputId)
                }
            }
        }
    }

    
    // C - Checking if a new output is being spent on the same block, as we will include it directly spent on the database
    // Otherwise just add the query of a new output
    for (var i = 0; i < newOutputs.length; i++) {
        var match = false
        for (var j = 0; j < spentOutputs.length; j++) {
            if (newOutputs[i].outputId == spentOutputs[j]) {
                match = true
                
                // Add inupt as already spent
                var sqlQuery = SqlComposer.InsertAlreadySpentOutput(params, newOutputs[i].outputId, api.height, BigInt(newOutputs[i].value), newOutputs[i].address, "sc")
                sqlBatch.push(sqlQuery)

                // Remove the element from spentOutputs
                spentOutputs.splice(j, 1)
                j--
            }
        }

        if (match == false) {
            // It was not spent: add a new unspent output to the database
            var sqlQuery = SqlComposer.CreateOutput(params, "Outputs-SC", newOutputs[i].outputId, BigInt(newOutputs[i].value), newOutputs[i].address, api.height)
            sqlBatch.push(sqlQuery)
        }

        // D - Introducing in the SQL database the new output as hash type
        var toAddHashTypes = "('" + newOutputs[i].outputId + "','output','')"
        var sqlQuery = SqlComposer.InsertSql(params, "HashTypes", toAddHashTypes, newOutputs[i].outputId)
        sqlBatch.push(sqlQuery)
    }

    // E - SF output spent in the same block
    for (var i = 0; i < newSfOutputs.length; i++) {
        var match = false
        for (var j = 0; j < spentSfOutputs.length; j++) {
            if (newSfOutputs[i].outputId == spentSfOutputs[j]) {
                match = true
                
                // Add inupt as already spent
                var sqlQuery = SqlComposer.InsertAlreadySpentOutput(params, newSfOutputs[i].outputId, api.height, BigInt(newSfOutputs[i].value), newSfOutputs[i].address, "sf")
                sqlBatch.push(sqlQuery)

                // Remove the element from spentOutputs
                spentSfOutputs.splice(j, 1)
                j--
            }
        }

        if (match == false) {
            // It was not spent: add a new unspent output to the database
            var sqlQuery = SqlComposer.CreateOutput(params, "Outputs-SF", newSfOutputs[i].outputId, BigInt(newSfOutputs[i].value), newSfOutputs[i].address, api.height)
            sqlBatch.push(sqlQuery)
        }

        // New output as hash type
        var toAddHashTypes = "('" + newSfOutputs[i].outputId + "','output','')"
        var sqlQuery = SqlComposer.InsertSql(params, "HashTypes", toAddHashTypes, newSfOutputs[i].outputId)
        sqlBatch.push(sqlQuery)
    }


    // F - Updating spent outputs
    // SC
    for (var i = 0; i < spentOutputs.length; i++) {
        var sqlQuery = SqlComposer.UpdateOutput(params, spentOutputs[i], api.height)
        sqlBatch.push(sqlQuery)
    }

    // SF
    for (var i = 0; i < spentSfOutputs.length; i++) {
        var sqlQuery = SqlComposer.UpdateOutput(params, spentSfOutputs[i], api.height)
        sqlBatch.push(sqlQuery)
    }

    return sqlBatch
}


exports.SfClaimOutput = async function(params, sqlBatch, senderClaim, senderClaimAddress, txHash, height) {
    // Adds the output created during a SF fees claim

    // Currently, the consensus/block API does not indicate in any field which is the outputID of the claimed fees. This used to be on 
    // siafundclaimoutputids on the explorer API
    // As a temporal solution, I use the explorer module. Even if broken, it should be able to provide this info

    // Only if the explorer module is available
    if (params.explorerAvailable == true) {
        
        // We make this call as a "one try" method (the "true"), as the `/explorer/hashes` API sometimes might fall without any specific reason,
        // and it is better just going to the failover solution of getting the full block
        var api = await Commons.MegaRouter(params, 0, "/explorer/hashes/" + txHash, true)

        try {
            var outputId = api.transaction.siafundclaimoutputids[0]
        } catch (e) {
            // In some cases, the /explorer/hashes endpoint will return a wrong result without the output, if this happens, we instead
            // collect the full block info, that is more costly
            try {
                var apiBlock = await Commons.MegaRouter(params, 0, '/explorer/blocks/' + height)
                for (var i = 0; i < apiBlock.block.transactions.length; i++) {
                    if (apiBlock.block.transactions[i].id == txHash) {
                        var outputId = apiBlock.block.transactions[i].siafundclaimoutputids[0]
                    }
                }
            
            } catch (e) {
                // Stops the script to allow a graceful restart by Forever/PM2 if something unexpected stopped the indexer. As the script runs also the API server and the
                // database connector, otherwise the script would keep running
                console.log(e)
                console.log("*** Forcing the stop of the script in 20 seconds")
                await Commons.Delay(20000); // Async timeout
                process.exit()
            }    
        }
        
        
        // Push output to the batch: new output and outputID as a hash type
        var sqlQuery = SqlComposer.CreateOutput(
            params, "Outputs-SC", outputId, BigInt(senderClaim), senderClaimAddress, height)
        sqlBatch.push(sqlQuery)

        var toAddHashTypes = "('" + outputId + "','output','')"
        var sqlQuery = SqlComposer.InsertSql(params, "HashTypes", toAddHashTypes, outputId)
        sqlBatch.push(sqlQuery)
    }

    // Return the updated batch
    return sqlBatch
}


exports.MiningPoolPayoutOutput = async function(params, sqlBatch, api, height, payoutAddress) {
    // Identifies the output recepient of the block reward

    // Info currently missing from the consensus/block API. As a temporal solution, this relies on a call to the explorer API until
    // Nebulous adds this info to the consensus API. If the usuer decides to not use the explorer module, this infor will not be used

    // Only if the explorer module is available
    if (params.explorerAvailable == true) {
        try {
            var apiExplorer = await Commons.MegaRouter(params, 0, '/explorer/blocks/' + height)
            var outputId = apiExplorer.block.minerpayoutids[0]

            // New output
            var sqlQuery = SqlComposer.CreateOutput(
                params, "Outputs-SC", outputId, BigInt(api.minerpayouts[0].value), payoutAddress, height)
            sqlBatch.push(sqlQuery)

            // Output as hash type
            var toAddHashTypes = "('" + outputId + "','output','')"
            sqlBatch.push(SqlComposer.InsertSql(params, "HashTypes", toAddHashTypes, outputId))

        } catch (e) {
            console.log("//// Could not retrieve the block from the explorer API for the outputID of the mining pool payout. This output has been skipped")
            console.log(e)
        }
    }

    return sqlBatch
}


exports.ContractResolutionOutputs = function(params, height, sqlBatch, outputId, address, value) {
    // Creates outputs for contract resolutions

    // Avoiding non-existant outputs from legacy contracts
    if (address.slice(0,10) != "Unexistent") {

        // New output
        var sqlQuery = SqlComposer.CreateOutput(
            params, "Outputs-SC", outputId, BigInt(value), address, height)
        sqlBatch.push(sqlQuery)

        // Output as hash type
        var toAddHashTypes = "('" + outputId + "','output','')"
        sqlBatch.push(SqlComposer.InsertSql(params, "HashTypes", toAddHashTypes, outputId))
    }
    
    return sqlBatch
}
