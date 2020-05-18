// Finder of parent transactions, using Navigator's own SQL database. Makes an API comparable to the Explorer one
var exports = module.exports={}
var SqlAsync = require('./sql_async.js')
var SqlComposer = require("./sql_composer.js")

exports.ParentFinder = async function(params, api) {
    var orphanOutputs =[] // In this array we accumulate the outputs to search, so we create a small number of SQL queries

    // A - Transactions
    for (var i = 0; i < api.transactions.length; i++) {
        try {
            api.transactions[i].rawtransaction = {
                siacoininputs: null,
                minerfees: null,
                siacoinoutputs: null,
                siafundinputs: null,
                siafundoutputs: null
            }
    
            // A1 - rawtransaction.siacoininputs
            api.transactions[i].rawtransaction.siacoininputs = api.transactions[i].siacoininputs
    
            // A2 - rawtransaction.minerfees
            api.transactions[i].rawtransaction.minerfees = api.transactions[i].minerfees
    
            // A3 - rawtransactions.siacoinoutputs
            api.transactions[i].rawtransaction.siacoinoutputs = api.transactions[i].siacoinoutputs
    
            // A4 - siacoinoutputids
            api.transactions[i].siacoinoutputids = []
            for (var j = 0; j < api.transactions[i].siacoinoutputs.length; j++) {
                var newId = api.transactions[i].siacoinoutputs[j].id
                api.transactions[i].siacoinoutputids.push(newId)
            }

            // A5 - siacoininputoutputs. Creting a blank array
            api.transactions[i].siacoininputoutputs = []
            for (var j = 0; j < api.transactions[i].siacoininputs.length; j++) {
                api.transactions[i].siacoininputoutputs.push({
                    id: api.transactions[i].siacoininputs[j].parentid,
                    value: 0,
                    unlockhash: "unknown address"
                })
            }


            // Siafunds
            // A6 - rawtransaction.siafundinputs
            api.transactions[i].rawtransaction.siafundinputs = api.transactions[i].siafundinputs

            // A7 - rawtransaction.siafundoutputs
            api.transactions[i].rawtransaction.siafundoutputs = []
            for (var j = 0; j < api.transactions[i].siafundoutputs.length; j++) {
                api.transactions[i].rawtransaction.siafundoutputs.push({
                    value: api.transactions[i].siafundoutputs[j].value,
                    unlockhash: api.transactions[i].siafundoutputs[j].unlockhash,
                    claimstart: 0 // unnecessary for my own code
                })
            }

            // A8 - siafundoutputids
            api.transactions[i].siafundoutputids = []
            for (var j = 0; j < api.transactions[i].siafundoutputs.length; j++) {
                var newId = api.transactions[i].siafundoutputs[j].id
                api.transactions[i].siafundoutputids.push(newId)
            }

            // A9 - siafundinputoutputs. Creting a blank array
            api.transactions[i].siafundinputoutputs = []
            for (var j = 0; j < api.transactions[i].siafundinputs.length; j++) {
                api.transactions[i].siafundinputoutputs.push({
                    id: api.transactions[i].siafundinputs[j].parentid,
                    value: 0,
                    unlockhash: "unknown address"
                })
            }
            
            // Misc
            // A10 - Arbitrary data
            api.transactions[i].rawtransaction.arbitrarydata = api.transactions[i].arbitrarydata

            // A11 - File contracts data
            api.transactions[i].rawtransaction.filecontracts = api.transactions[i].filecontracts
            if (api.transactions[i].filecontracts.length != 0) {
                api.transactions[i].filecontractids = [api.transactions[i].filecontracts[0].id]
            }

            api.transactions[i].rawtransaction.filecontractrevisions = api.transactions[i].filecontractrevisions
            api.transactions[i].rawtransaction.storageproofs = api.transactions[i].storageproofs

        } catch (e) {
            console.log("// PARENT FINDER - Error on the loop A on Tx#" + i + " of block #" + api.height)
            console.log(e)
        }
    }

    // B - Transactions second loop (we need the info added on the first for this second loop)
    for (var i = 0; i < api.transactions.length; i++) {
        try {
            // B1 - siacoininputoutputs
            // Requires SQL search, but we find first if it is in this same block
            if (api.transactions[i].rawtransaction.siacoininputs.length > 0) { // Avoids TX with only arbitrary data
                for (var k = 0; k < api.transactions[i].rawtransaction.siacoininputs.length; k++) { // For each of the inputs of the transaction
                    var match = false
                    var senderMatcher = api.transactions[i].rawtransaction.siacoininputs[k].parentid
                    for (var j = 0; j < api.transactions.length; j++) {
                        // This if limits the search and avoids crashes
                        if (api.transactions[j].siacoininputs.length != 0 && api.transactions[j].siacoinoutputids != null) {

                            // For each siacoinoutputid:
                            for (var l = 0; l < api.transactions[j].siacoinoutputids.length; l++) {
                                if (api.transactions[j].siacoinoutputids[l] == senderMatcher) { // Match of the sender TX: it is the same block
                                    match = true
                                    api.transactions[i].siacoininputoutputs[k].id = api.transactions[j].siacoinoutputs[l].id,
                                    api.transactions[i].siacoininputoutputs[k].value = api.transactions[j].siacoinoutputs[l].value,
                                    api.transactions[i].siacoininputoutputs[k].unlockhash = api.transactions[j].siacoinoutputs[l].unlockhash
                                }
                            }
                        }
                    }
                    if (match == false) {
                        // Search in the database for these Outputs. I need the amount and the address holding them
                        for (var j = 0; j < api.transactions[i].siacoininputs.length; j++) {
                            var outputToFind = api.transactions[i].siacoininputs[j].parentid
                            // We add the outputId (artificial, it does not exist on the explorer API) to later assign the data when we search in batch
                            api.transactions[i].siacoininputoutputs[j].id = outputToFind 
                            orphanOutputs.push(outputToFind) // Push to array for SQL batch search
                        }
                    }
                }
            }
        } catch (e) {
            console.log("// PARENT FINDER - Error on the loop B on Tx#" + i + " of block #" + api.height)
            console.log(e)
        }
    } 


    // B2 - siafunfinputoutputs loop, for SF transactions.
    for (var i = 0; i < api.transactions.length; i++) {
        if (api.transactions[i].siafundinputs.length != 0) { // This is a SF transaction
            var match = false
            for (var k = 0; k < api.transactions[i].rawtransaction.siafundinputs.length; k++) { // For each of the inputs of the transaction
                var senderMatcher = api.transactions[i].rawtransaction.siafundinputs[k].parentid
                // First we try to find the input-output in this same block
                for (var j = 0; j < api.transactions.length; j++) {
                    // This if limits the search and avoids crashes
                    if (api.transactions[j].siafundinputs.length != 0 && api.transactions[j].siafundoutputids != null) {
                        
                        // For each siafundoutputids:
                        for (var l = 0; l < api.transactions[j].siafundoutputids.length; l++) {
                            if (api.transactions[j].siafundoutputids[l] == senderMatcher) { // Match of the sender TX
                                match = true
                                // Claimblock is not a real part of the the explorer API, but helps my code to lated find out the claimed coins from the SF Tx.
                                // It is the block this output was created. To avoid breaking compatibility, we set up a claimstart of 0 by default
                                api.transactions[i].siafundinputoutputs[k].id = api.transactions[j].siafundoutputs[l].id
                                api.transactions[i].siafundinputoutputs[k].value = api.transactions[j].siafundoutputs[l].value
                                api.transactions[i].siafundinputoutputs[k].unlockhash = api.transactions[j].siafundoutputs[l].unlockhash
                                api.transactions[i].siafundinputoutputs[k].claimblock = api.height
                                api.transactions[i].siafundinputoutputs[k].claimstart = 0
                            }
                        }
                    }
                }

                if (match == false) {
                    // Search in the database for these Outputs. I need the amount and the address holding them
                    for (var j = 0; j < api.transactions[i].siafundinputs.length; j++) {
                        var outputToFind = api.transactions[i].siafundinputs[j].parentid
                        // We add the outputId (artificial, it does not exist on the explorer API) to later assign the data when we search in batch
                        // Default claimstart = 0
                        api.transactions[i].siafundinputoutputs[j].id = outputToFind
                        api.transactions[i].siafundinputoutputs[j].claimstart = 0
                        orphanOutputs.push(outputToFind) // Push to array for SQL batch search
                    }
                }
            }
        }
    }

    // C - Remove duplicates frim the orphans list. We make a set and then revert to an array
    orphanOutputs = [...new Set(orphanOutputs)];

    // D - SQL search in bacth of these outputs, managed in "sqlArgumentsSize"-sized queries by the sql_composer module
    resultArray = []
    while (orphanOutputs.length > 0) {
        if (orphanOutputs.length <= params.sqlArgumentsSize) {
            // Send the rest
            var splice = orphanOutputs.splice(0, orphanOutputs.length)
        } else {
            // Make an slplice of params.sqlArgumentsSize-size (default:1000)
            var splice = orphanOutputs.splice(0, params.sqlArgumentsSize)
        }
        var sqlQuery = await SqlComposer.MultiSelect("OutputId, ScValue, SfValue, Address, CreatedOnBlock", "Outputs", "OutputId", splice, true)      
        var result = await SqlAsync.Sql(params, sqlQuery) // Async call
        resultArray = resultArray.concat(result) // Concatenating results to a single array
    }


    // E - Assigning the results of the SQL query to the enriched API
    for (var i = 0; i < api.transactions.length; i++) {
        // Siacoin
        if (api.transactions[i].siacoininputoutputs != null && api.transactions[i].siacoininputoutputs != []) {
            for (var j = 0; j < api.transactions[i].siacoininputoutputs.length; j++) {
                for (var k = 0; k < resultArray.length; k++) {
                    if (api.transactions[i].siacoininputoutputs[j].id == resultArray[k].OutputId) {
                        if (resultArray[k].Address == null) {
                            // Malformed input. It should not happen normally, only during debugging
                            api.transactions[i].siacoininputoutputs[j].value = 0
                            api.transactions[i].siacoininputoutputs[j].unlockhash = "unknown address"
                        } else {
                            // It is a big int, treat is as a string without scientific notation for compatibilty with the old explorer API
                            api.transactions[i].siacoininputoutputs[j].value = resultArray[k].ScValue.toLocaleString('fullwide', {useGrouping:false}) 
                            
                            api.transactions[i].siacoininputoutputs[j].unlockhash = resultArray[k].Address
                        }
                        
                        
                    }
                }
            }
        }

        // SiaFund
        if (api.transactions[i].siafundinputoutputs != null && api.transactions[i].siafundinputoutputs != []) {
            for (var j = 0; j < api.transactions[i].siafundinputoutputs.length; j++) {
                for (var k = 0; k < resultArray.length; k++) {
                    if (api.transactions[i].siafundinputoutputs[j].id == resultArray[k].OutputId) {
                        api.transactions[i].siafundinputoutputs[j].value = resultArray[k].SfValue
                        api.transactions[i].siafundinputoutputs[j].unlockhash = resultArray[k].Address
                        
                        // Claimblock is not a real part of the the explorer API, but helps my code to lated find out the claimed coins from the SF Tx.
                        // It is the block this output was created
                        api.transactions[i].siafundinputoutputs[j].claimblock = resultArray[k].CreatedOnBlock

                        // Calculating the claimstart. It is the totalContractCost of the block the output was created
                        var sqlQuery = "SELECT TotalContractCost FROM BlockInfo WHERE Height=" + resultArray[k].CreatedOnBlock
                        var result = await SqlAsync.Sql(params, sqlQuery)
                        api.transactions[i].siafundinputoutputs[j].claimstart = result[0].TotalContractCost.toString
                    }
                }
            }
        }
    }

    return api
}