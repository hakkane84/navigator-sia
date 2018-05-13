// ============================
//      SIAFUND OPERATIONS
// ============================

var exports = module.exports={}

// Load external modules
var SqlFunctions = require('../modules/sqlfunctions.js')


exports.genesisBlockProcess = function(apiblock, n, height, timestamp) {
    var newSql = []
    var totalSFtransacted = 0
    var addressesImplicated = []
    var synonymHahses = []
    var masterHash = apiblock.transactions[0].id
    var minerFees = 0
    for (k = 0; k < apiblock.transactions[0].rawtransaction.siafundoutputs.length; k++) {
        var receiverHash = apiblock.transactions[0].rawtransaction.siafundoutputs[k].unlockhash
        var receiverAmount = apiblock.transactions[0].rawtransaction.siafundoutputs[k].value
        addressesImplicated.push({"hash": receiverHash, "sc": 0, "sf": receiverAmount})
        totalSFtransacted = totalSFtransacted + parseInt(receiverAmount)
    } 
    // Saving the data in SQL Insert queries
    for (var m = 0; m < addressesImplicated.length; m++) {
        var toAddAddressChanges = "('" + addressesImplicated[m].hash + "','" + masterHash + "'," + addressesImplicated[m].sc + 
            "," + addressesImplicated[m].sf + "," + height + "," + timestamp + ",'SfTx')"
        var checkString = addressesImplicated[m].hash + "' and MasterHash='" + masterHash 
        // This check will look rows with the fields Address and MasterHash to not include a duplicate
        newSql.push(SqlFunctions.insertSql("AddressChanges", toAddAddressChanges, checkString))
        
        // Addresses as hash types
        var toAddHashTypes = "('" + addressesImplicated[m].hash + "','address','')"
        newSql.push(SqlFunctions.insertSql("HashTypes", toAddHashTypes, addressesImplicated[m].hash))
    }
    // Tx info
    var toAddTxInfo = "('" + masterHash + "','" + synonymHahses + "'," + height + "," + timestamp + "," + minerFees + ")"
    newSql.push(SqlFunctions.insertSql("TxInfo", toAddTxInfo, masterHash))

    // Saving TX as a component of a block
    var toAddBlockTransactions = "(" + height + ",'" + masterHash + "','SfTx',0," + totalSFtransacted + ")"
    newSql.push(SqlFunctions.insertSql("BlockTransactions", toAddBlockTransactions, masterHash))

    // MasterHash as a hash type
    var toAddHashTypes = "('" + masterHash + "','SfTx','" + masterHash + "')"
    newSql.push(SqlFunctions.insertSql("HashTypes", toAddHashTypes, masterHash))

    // Returns an array with all the SQL sentences
    return newSql

}


exports.sfTransactionProcess = function(apiblock, n, height, timestamp) {
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
        addressesImplicated.push({"hash": receiverHash, "sc": 0, "sf": receiverAmount})
        totalSFtransacted = totalSFtransacted + parseInt(receiverAmount)
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
                    var senderClaim = apiblock.transactions[i].siafundinputoutputs[j].claimstart
                    senderClaim = ((apiblock.totalcontractcost * 0.039) - senderClaim) / 10000
                    totalSCtransacted = totalSCtransacted + parseInt(senderClaim)
                    senderClaimAddress = apiblock.transactions[i].rawtransaction.siafundinputs[j].claimunlockhash
                    // Saving the claim independently, as it is a diffirent kind of SC address change ("SfClaim")
                    var toAddAddressChanges = "('" + senderClaimAddress + "','" + masterHash + "'," + senderClaim + 
                        ",0," + height + "," + timestamp + ",'SfClaim')"
                    var checkString = senderClaimAddress + "' and MasterHash='" + masterHash 
                    newSql.push(SqlFunctions.insertSql("AddressChanges", toAddAddressChanges, checkString))
                    var toAddHashTypes = "('" + senderClaimAddress + "','address','')"
                    newSql.push(SqlFunctions.insertSql("HashTypes", toAddHashTypes, senderClaimAddress))

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
        console.log("Special SF transaction found and processed")
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
                    addressesImplicated.push({"hash": senderHash, "sc": senderAmount, "sf": 0})
                }

                // Return address of the unused output
                if (apiblock.transactions[i].rawtransaction.siacoinoutputs.length > 1) {
                    // In most of the cases, part of the output returns to the address of the sender
                    var receiverHash = apiblock.transactions[i].rawtransaction.siacoinoutputs[1].unlockhash // [0] Goes to pay miner fees, it is just an intermediate address
                    var receiverAmount = apiblock.transactions[i].rawtransaction.siacoinoutputs[1].value
                    addressesImplicated.push({"hash": receiverHash, "sc": receiverAmount, "sf": 0})
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


    // Saving the data in SQL Insert queries
    for (var m = 0; m < synonymHahses.length; m++) {
        var toAddHashTypes = "('" + synonymHahses[m] + "','SfTx','" + masterHash + "')"
        newSql.push(SqlFunctions.insertSql("HashTypes", toAddHashTypes, synonymHahses[m]))
    }

    for (var m = 0; m < addressesImplicated.length; m++) {
        var toAddAddressChanges = "('" + addressesImplicated[m].hash + "','" + masterHash + "'," + addressesImplicated[m].sc + 
            "," + addressesImplicated[m].sf + "," + height + "," + timestamp + ",'SfTx')"
        var checkString = addressesImplicated[m].hash + "' and MasterHash='" + masterHash 
        // This check will look rows with the fields Address and MasterHash to not include a duplicate
        newSql.push(SqlFunctions.insertSql("AddressChanges", toAddAddressChanges, checkString))
        // Addresses as hash types
        var toAddHashTypes = "('" + addressesImplicated[m].hash + "','address','')"
        newSql.push(SqlFunctions.insertSql("HashTypes", toAddHashTypes, addressesImplicated[m].hash))
    }
    var toAddTxInfo = "('" + masterHash + "','" + synonymHahses + "'," + height + "," + timestamp + "," + minerFees + ")"
    newSql.push(SqlFunctions.insertSql("TxInfo", toAddTxInfo, masterHash))
    

    // Saving TX as a component of a block
    var toAddBlockTransactions = "(" + height + ",'" + masterHash + "','SfTx'," + totalSCtransacted + "," + totalSFtransacted + ")"
    newSql.push(SqlFunctions.insertSql("BlockTransactions", toAddBlockTransactions, masterHash))

    // Returns an array with all the SQL sentences
    var returnArray = [newSql, txsIndexed]
    return returnArray
}
