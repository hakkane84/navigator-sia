// Indexes SiaFund operations
var exports = module.exports={}
var SqlAsync = require('./sql_async.js')
var SqlComposer = require("./sql_composer.js")
var Outputs = require("./outputs.js")

exports.sfTransactionProcess = async function(params, apiblock, n, height, timestamp, totalContractCost) {
    // SF TX are composed of 3 TX in sequence:
    // 1- A "sending tx" that pays the miner fees in SC. The rest of the output returns to the wallet of the sender, to another address
    // 2- A "sending tx" for the SFs
    // 3- The proper TX where the SFs are sent to the receiver, and the miner fees are paid
    // For SFs, first we find the TX of the receiver and from it we find the tx of the sender and the TX of Siacoins used to pay fees

    var totalSFtransacted = 0
    var totalSCtransacted = 0
    var minerFees = 0
    var addressesImplicated = []
    var synonymHahses = []
    var newSql = []
    var txsIndexed = []
    txsIndexed.push(n)

    // Receivers info
    for (var i = 0; i < apiblock.transactions[n].rawtransaction.siafundoutputs.length; i++) { // in case of several receivers
        var receiverHash = apiblock.transactions[n].rawtransaction.siafundoutputs[i].unlockhash
        var receiverAmount = apiblock.transactions[n].rawtransaction.siafundoutputs[i].value
        totalSFtransacted = totalSFtransacted + parseInt(receiverAmount)

        // In case of several outputs being received by the same address: we add the amounts ro the first entry if the same address appears again
        var receiverRepeatedBool = false
        for (k = 0; k < addressesImplicated.length; k++) {
            if (receiverHash == addressesImplicated[k].hash) { // Merging amounts
                addressesImplicated[k].sf = addressesImplicated[k].sf + receiverAmount
                receiverRepeatedBool = true
            }
        }
        if (receiverRepeatedBool == false) { // If address not repeated, then add the operation
            addressesImplicated.push({"hash": receiverHash, "sc": 0, "sf": receiverAmount})
        }
    }

    // Synonyms on the receiver TX
    synonymHahses.push(apiblock.transactions[n].id)

    // Miner fees
    var minerFees = apiblock.transactions[n].siacoininputoutputs[0].value

    // 2 - Finding the sender TX in the same block
    var senderFound = false
    var senderMatcher = apiblock.transactions[n].rawtransaction.siafundinputs[0].parentid
    for (i = 0; i < apiblock.transactions.length; i++) {
        // This limits the search to sending SF transactions:
        if (apiblock.transactions[i].rawtransaction.siafundinputs.length != 0 && apiblock.transactions[i].rawtransaction.siacoininputs.length == 0) {
            if (apiblock.transactions[i].siafundoutputids[0] == senderMatcher) { //Localizes the sender TX
                senderFound = true
                txsIndexed.push(i)
                var masterHash = apiblock.transactions[i].id // I abitrarily decide the sender's TX hash is the "Master Hash"
                for (var j = 0; j < apiblock.transactions[i].siafundinputoutputs.length; j++) { // in case of several inputs addresses
                    var senderHash = apiblock.transactions[i].siafundinputoutputs[j].unlockhash
                    var senderAmount = (apiblock.transactions[i].siafundinputoutputs[j].value) * -1
                    
                    // SC dividend claim is calculated from the totalcontractcost minus the part indicated in claimstart
                    var senderClaimBlock = apiblock.transactions[i].siafundinputoutputs[j].claimblock // The block of the creation of the parent input

                    // Finding the totalContractCost at that block
                    var sqlQuery = "SELECT TotalContractCost FROM BlockInfo WHERE Height=" + senderClaimBlock
                    var result = await SqlAsync.Sql(params, sqlQuery)
                    try {
                        var prevTotalContractCost = BigInt(result[0].TotalContractCost)
                    } catch (e) {
                        var prevTotalContractCost = BigInt(0)
                    }

                    // Calculating the claim
                    senderClaim = Number(totalContractCost - prevTotalContractCost) * params.blockchain.siafundFees / params.blockchain.totalSiafunds
                    senderClaim = senderClaim * apiblock.transactions[i].siafundinputoutputs[j].value // We multiply it by the number of SF transacted
                    totalSCtransacted = totalSCtransacted + Math.floor(senderClaim)
                    var senderClaimAddress = apiblock.transactions[i].rawtransaction.siafundinputs[j].claimunlockhash

                    // Claim output creation
                    newSql = await Outputs.SfClaimOutput(params, newSql, senderMatcher, BigInt(senderClaim), senderClaimAddress, apiblock.transactions[i].id, apiblock.height)

                    // Adding the claim to addressesImplicated with a flag: It is indexed, but we need the info to update the balance of the address
                    addressesImplicated.push({"hash": senderClaimAddress, "sc": senderClaim, "sf": 0, "txType": "SfClaim"})

                    // In some consolidation operations, individual SF coming from the same address are possible, so if the senderHash is already 
                    // in addressesImplicated, then merge the amounts. Otherwise, the SQL controler will not admit duplicates
                    var senderRepeatedBool = false
                    for (k = 0; k < addressesImplicated.length; k++) {
                        if (senderHash == addressesImplicated[k].hash) { // Merging amounts
                            addressesImplicated[k].sf = addressesImplicated[k].sf + senderAmount
                            senderRepeatedBool = true
                        }
                    }
                    if (senderRepeatedBool == false) { // If address not repeated, then add the operation
                        addressesImplicated.push({"hash": senderHash, "sc": 0, "sf": senderAmount})
                    }
                }
                // Synonyms on the sender TX
                synonymHahses.push(apiblock.transactions[i].id)

                // Second receiver
                // when part of the SF transacted return to the wallet of the sender, the information of this receiver address is in the TX of the sender
                var outputsNumber = apiblock.transactions[i].rawtransaction.siafundoutputs.length
                if (outputsNumber > 1) { // If there is more than 1 output here, check the info of the second one
                    // The second receiver (wallet of the sender is included as oone of the outputs in the same TX where the sender info is located)
                    var receiver2Hash = apiblock.transactions[i].rawtransaction.siafundoutputs[outputsNumber-1].unlockhash
                    var receiver2Amount = apiblock.transactions[i].rawtransaction.siafundoutputs[outputsNumber-1].value
                    addressesImplicated.push({"hash": receiver2Hash, "sc": 0, "sf": receiver2Amount})
                    totalSFtransacted = totalSFtransacted + parseInt(receiver2Amount)
                }
            }
        }
    }
    if (senderFound == false) { 
        // There is a very weird number of cases of SF transactions implicating only one TX. They are related to Nebulous Siafunds. Here, the sender info is in the receiver TX
        //console.log("** Special SF transaction found and processed")
        var masterHash = apiblock.transactions[n].id
        for (var j = 0; j < apiblock.transactions[n].siafundinputoutputs.length; j++) { // in case of several inputs
            // To avoid duplication in addresses, search if the address is already computed and update the balance
            var matchBool = false
            for (var k = 0; k < addressesImplicated.length; k++) {
                if (addressesImplicated[k].hash == apiblock.transactions[n].siafundinputoutputs[j].unlockhash) {
                    addressesImplicated[k].sf = addressesImplicated[k].sf - apiblock.transactions[n].siafundinputoutputs[j].value
                    matchBool = true
                }
            }
            if (matchBool == false) {
                var senderHash = apiblock.transactions[n].siafundinputoutputs[j].unlockhash
                var senderAmount = (apiblock.transactions[n].siafundinputoutputs[j].value) * -1
                addressesImplicated.push({"hash": senderHash, "sc": 0, "sf": senderAmount})
            }


            // SC dividend claim is calculated from the totalcontractcost minus the part indicated in claimstart
            var senderClaimBlock = apiblock.transactions[n].siafundinputoutputs[j].claimblock // The block of the creation of the parent input

            // Finding the totalContractCost at that block
            var sqlQuery = "SELECT TotalContractCost FROM BlockInfo WHERE Height=" + senderClaimBlock
            var result = await SqlAsync.Sql(params, sqlQuery)
            try {
                var prevTotalContractCost = BigInt(result[0].TotalContractCost)
            } catch (e) {
                var prevTotalContractCost = BigInt(0)
            }

            // Calculating the claim
            senderClaim = Number(totalContractCost - prevTotalContractCost) * params.blockchain.siafundFees / params.blockchain.totalSiafunds
            senderClaim = senderClaim * apiblock.transactions[n].siafundinputoutputs[j].value // We multiply it by the number of SF transacted
            totalSCtransacted = totalSCtransacted + Math.floor(senderClaim)
            var senderClaimAddress = apiblock.transactions[n].rawtransaction.siafundinputs[j].claimunlockhash
			const siafundOutputID = apiblock.transactions[n].rawtransaction.siafundinputs[j].parentid

            // Claim output creation
            newSql = await Outputs.SfClaimOutput(params, newSql, siafundOutputID, BigInt(senderClaim), senderClaimAddress, apiblock.transactions[n].id, apiblock.height)

            // Adding the claim to addressesImplicated with a flag: It is indexed, but we need the info to update the balance of the address
            addressesImplicated.push({"hash": senderClaimAddress, "sc": senderClaim, "sf": 0, txType: "SfClaim"})
        }
    }

    // 1 - Finding the sender TX who pays the miner fees, in the same block
    var senderFound = false
    var senderMatcher = apiblock.transactions[n].rawtransaction.siacoininputs[0].parentid
    for (i = 0; i < apiblock.transactions.length; i++) {
        if (apiblock.transactions[i].rawtransaction.siacoinoutputs.length != 0 && apiblock.transactions[i].siacoinoutputids.length != 0) { // Limits the search to TX with SC implicated (avoids crashes)
            if (apiblock.transactions[i].siacoinoutputids[0] == senderMatcher) { //Localizes the sender TX
                senderFound = true
                txsIndexed.push(i)
                for (var j = 0; j < apiblock.transactions[i].siacoininputoutputs.length; j++) { // in case of several inputs addresses merging amounts
                    var senderHash = apiblock.transactions[i].siacoininputoutputs[j].unlockhash
                    var senderAmount = (apiblock.transactions[i].siacoininputoutputs[j].value) * -1
                    //totalSCtransacted = totalSCtransacted + apiblock.transactions[i].siacoininputoutputs[j].value
                    addressesImplicated.push({"hash": senderHash, "sc": senderAmount, "sf": 0, txType: "SfTx"})
                }

                // Return address of the unused output
                if (apiblock.transactions[i].rawtransaction.siacoinoutputs.length > 1) {
                    // In most of the cases, part of the output returns to the address of the sender
                    var receiverHash = apiblock.transactions[i].rawtransaction.siacoinoutputs[1].unlockhash // [0] Goes to pay miner fees, it is just an intermediate address
                    var receiverAmount = apiblock.transactions[i].rawtransaction.siacoinoutputs[1].value
                    addressesImplicated.push({"hash": receiverHash, "sc": receiverAmount, "sf": 0, txType: "SfTx"})
                    totalSCtransacted = totalSCtransacted + parseInt(receiverAmount) + parseInt(minerFees)
                } else {
                    //EXCEPTION: In a very few transactions the whole SC output is spent in miner fees, and nothing returns to the wallet of the sender
                    totalSCtransacted = totalSCtransacted + parseInt(minerFees)
                }

                // Pushing the TxID to the list of synonyms
                synonymHahses.push(apiblock.transactions[i].id)
            }
        }
    }
    // EXCEPTION: singlet TX where the parent TX paying the fees is not in the same block. Caused by F2pool that splits transactions
    if (senderFound == false) {
        var senderHash = apiblock.transactions[n].siacoininputoutputs[0].unlockhash
        var senderAmount = (apiblock.transactions[n].siacoininputoutputs[0].value) * -1
        addressesImplicated.push({"hash": senderHash, "sc": senderAmount, "sf": 0, txType: "SfTx"})
        totalSCtransacted = totalSCtransacted + parseInt(minerFees)
    }


    // Saving the data in SQL Insert queries
    for (var m = 0; m < synonymHahses.length; m++) {
        var toAddHashTypes = "('" + synonymHahses[m] + "','SfTx','" + masterHash + "')"
        newSql.push(SqlComposer.InsertSql(params, "HashTypes", toAddHashTypes, synonymHahses[m]))
    }

    // Adding the masterhash, neccesary for the Addresses routine
    for (var m = 0; m < addressesImplicated.length; m++) {
        addressesImplicated[m].masterHash = masterHash
    }

    var toAddTxInfo = "('" + masterHash + "','" + synonymHahses + "'," + height + "," + timestamp + "," + minerFees + ")"
    newSql.push(SqlComposer.InsertSql(params, "TxInfo", toAddTxInfo, masterHash))
    

    // Saving TX as a component of a block
    var toAddBlockTransactions = "(" + height + ",'" + masterHash + "','SfTx'," + totalSCtransacted + "," + totalSFtransacted + ")"
    newSql.push(SqlComposer.InsertSql(params, "BlockTransactions", toAddBlockTransactions, masterHash))

    // Returns an array with all the SQL sentences
    var returnArray = [newSql, txsIndexed, addressesImplicated]
    return returnArray
}


exports.sfSingleTransaction = async function(params, apiblock, n, height, timestamp, totalContractCost) {
    // EXCEPTION: Orphaned singlets
    // Special cases of transactions not paying miner fees. Only happens in pool payouts of certain mining pools (F2pool)

    var totalSFtransacted = 0
    var totalSCtransacted = 0
    var minerFees = 0
    var addressesImplicated = []
    var masterHash = apiblock.transactions[n].id
    var synonymHahses = []
    synonymHahses.push(apiblock.transactions[n].id)
    var newSql = []

    // Receivers info
    for (var i = 0; i < apiblock.transactions[n].rawtransaction.siafundoutputs.length; i++) { // in case of several receivers
        var receiverHash = apiblock.transactions[n].rawtransaction.siafundoutputs[i].unlockhash
        var receiverAmount = apiblock.transactions[n].rawtransaction.siafundoutputs[i].value
        addressesImplicated.push({"hash": receiverHash, "sc": 0, "sf": receiverAmount})
        totalSFtransacted = totalSFtransacted + parseInt(receiverAmount)
    }
    
    // Senders info
    for (var j = 0; j < apiblock.transactions[n].siafundinputoutputs.length; j++) { // in case of several inputs
        // To avoid duplication in addresses, search if the address is already computed and update the balance
        var matchBool = false
        for (var k = 0; k < addressesImplicated.length; k++) {
            if (addressesImplicated[k].hash == apiblock.transactions[n].siafundinputoutputs[j].unlockhash) {
                addressesImplicated[k].sf = addressesImplicated[k].sf - apiblock.transactions[n].siafundinputoutputs[j].value
                matchBool = true
            }
        }
        if (matchBool == false) {
            var senderHash = apiblock.transactions[n].siafundinputoutputs[j].unlockhash
            var senderAmount = (apiblock.transactions[n].siafundinputoutputs[j].value) * -1
            addressesImplicated.push({"hash": senderHash, "sc": 0, "sf": senderAmount})
        }
       
        // SC dividend claim is calculated from the totalcontractcost minus the part indicated in claimstart
        var senderClaimBlock = apiblock.transactions[n].siafundinputoutputs[j].claimblock // The block of the creation of the parent input

        // Finding the totalContractCost at that block
        var sqlQuery = "SELECT TotalContractCost FROM BlockInfo WHERE Height=" + senderClaimBlock
        var result = await SqlAsync.Sql(params, sqlQuery)
        try {
            var prevTotalContractCost = BigInt(result[0].TotalContractCost)
        } catch (e) {
            var prevTotalContractCost = BigInt(0)
        }

        // Calculating the claim
        senderClaim = Number(totalContractCost - prevTotalContractCost) * params.blockchain.siafundFees / params.blockchain.totalSiafunds
        senderClaim = senderClaim * apiblock.transactions[n].siafundinputoutputs[j].value // We multiply it by the number of SF transacted
        totalSCtransacted = totalSCtransacted + Math.floor(senderClaim)
        var senderClaimAddress = apiblock.transactions[n].rawtransaction.siafundinputs[j].claimunlockhash
		const siafundOutputID = apiblock.transactions[n].rawtransaction.siafundinputs[j].parentid

        // Claim output creation
        newSql = await Outputs.SfClaimOutput(params, newSql, siafundOutputID, BigInt(senderClaim), senderClaimAddress, apiblock.transactions[n].id, apiblock.height)

        // Adding the claim to addressesImplicated with a flag of txType
        addressesImplicated.push({"hash": senderClaimAddress, "sc": senderClaim, "sf": 0, txType: "SfClaim"})
    }

    // Saving the data in SQL Insert queries
    for (var m = 0; m < synonymHahses.length; m++) {
        var toAddHashTypes = "('" + synonymHahses[m] + "','SfTx','" + masterHash + "')"
        newSql.push(SqlComposer.InsertSql(params, "HashTypes", toAddHashTypes, synonymHahses[m]))
    }

    var toAddTxInfo = "('" + masterHash + "','" + synonymHahses + "'," + height + "," + timestamp + "," + minerFees + ")"
    newSql.push(SqlComposer.InsertSql(params, "TxInfo", toAddTxInfo, masterHash))
    
    // Saving TX as a component of a block
    var toAddBlockTransactions = "(" + height + ",'" + masterHash + "','SfTx'," + totalSCtransacted + "," + totalSFtransacted + ")"
    newSql.push(SqlComposer.InsertSql(params, "BlockTransactions", toAddBlockTransactions, masterHash))

    // Adding the master hash to Addresses array
    for (var m = 0; m < addressesImplicated.length; m++) {
        addressesImplicated[m].masterHash = masterHash
    }

    // I return 2 elements
    var returnArray = [newSql, addressesImplicated]
    return returnArray    
}