// =============================
//      SIACOINS OPERATIONS
// =============================

var exports = module.exports={}

// Load external modules
var SqlFunctions = require('../modules/sqlfunctions.js')


exports.scTransactionProcess = function(apiblock, n, height, timestamp) {
    
    var totalSCtransacted = 0
    var addressesImplicated = []
    var synonymHahses = []
    var hostAnnouncementBool = false
    var newSql = []
    var txsIndexed = [] 
    txsIndexed.push(n) // Marking the master TX as indexed
    
    // Receivers info
    for (var i = 0; i < apiblock.transactions[n].rawtransaction.siacoinoutputs.length; i++) { // in case of several receivers
        var receiverHash = apiblock.transactions[n].rawtransaction.siacoinoutputs[i].unlockhash
        var receiverAmount = parseInt(apiblock.transactions[n].rawtransaction.siacoinoutputs[i].value)
        totalSCtransacted = totalSCtransacted + receiverAmount
        
        // In case of several outputs being received by the same address: we add the amounts ro the first entry if the same address appears again
        var receiverRepeatedBool = false
        for (k = 0; k < addressesImplicated.length; k++) {
            if (receiverHash == addressesImplicated[k].hash) { // Merging amounts
                addressesImplicated[k].sc = addressesImplicated[k].sc + receiverAmount
                receiverRepeatedBool = true
            }
        }
        if (receiverRepeatedBool == false) { // If address not repeated, then add the operation
            addressesImplicated.push({"hash": receiverHash, "sc": receiverAmount})
        }
    }
    // Synonyms on the receiver TX
    synonymHahses.push(apiblock.transactions[n].id)

    var minerFees = parseInt(apiblock.transactions[n].rawtransaction.minerfees) // Miner fees
    var masterHash = apiblock.transactions[n].id // I abitrarily decide the receiver's TX hash is the "Master Hash" (as in the SiaUI) (different from SF operations, legacy reasons)

    // Determining if the TX is a Host announcement
    var arbitraryData = apiblock.transactions[n].rawtransaction.arbitrarydata
    if (arbitraryData.length > 0) {
        slice = arbitraryData[0].slice(0,14)
        if (slice == "SG9zdEFubm91bm") {
            hostAnnouncementBool = true

            var hostIp = arbitraryData[0].slice(32)
            var s = hostIp.search("AAAAAAAAAA")
            hostIp = hostIp.slice(0 , (s-9))
            var decodedIp = Buffer.from(hostIp, 'base64').toString('ascii')
        }
    }

    // Finding the sender TX in the same block
    var senderFound = false
    var senderMatcher = apiblock.transactions[n].rawtransaction.siacoininputs[0].parentid
    for (i = 0; i < apiblock.transactions.length; i++) {
        // This limits the search to sending SC transactions (has SC inputs and didn't paid fees):
        if (apiblock.transactions[i].rawtransaction.siacoininputs.length != 0 && apiblock.transactions[i].rawtransaction.minerfees.length == 0) {
            if (apiblock.transactions[i].siacoinoutputids != null) { // This check avoids crashes that could happen in a very small number of blocks
                if (apiblock.transactions[i].siacoinoutputids[0] == senderMatcher) { //Localizes the sender TX

                    senderFound = true
                    txsIndexed.push(i) // Marking it as indexed
                    for (var j = 0; j < apiblock.transactions[i].siacoininputoutputs.length; j++) { // in case of several inputs addresses
                        var senderHash = apiblock.transactions[i].siacoininputoutputs[j].unlockhash
                        var senderAmount = (apiblock.transactions[i].siacoininputoutputs[j].value) * -1

                        // In some SIaFund consolidation operations, individual SF coming from the same address are possible, so if the senderHash is already 
                        // in addressesImplicated, then merge the amounts. Otherwise, the SQL controler will not admit duplicates. I have not seen directly SC operations
                        // behaving like this, but for security, I implement this loop
                        var senderRepeatedBool = false
                        for (k = 0; k < addressesImplicated.length; k++) {
                            if (senderHash == addressesImplicated[k].hash) { // Merging amounts
                                addressesImplicated[k].sc = addressesImplicated[k].sc + senderAmount
                                senderRepeatedBool = true
                            }
                        }
                        if (senderRepeatedBool == false) { // If address not repeated, then add the operation
                            addressesImplicated.push({"hash": senderHash, "sc": senderAmount})
                        }

                    }
                    // In the "sender TX", part is sent to an "auxiliary address" (that will be decomposed in the "receiver TX") and the rest resturns to a second
                    // address of the sender. Let's identify this second receiver/s:
                    var outputsNumber = apiblock.transactions[i].rawtransaction.siacoinoutputs.length
                    if (outputsNumber > 1) { // If there is more than 1 output here, check the info of the second one
                        for (k = 1; k < outputsNumber; k++) { // starting in k = 1 we discard the first output (auxiliary address)
                            var receiver2Hash = apiblock.transactions[i].rawtransaction.siacoinoutputs[k].unlockhash
                            var receiver2Amount = parseInt(apiblock.transactions[i].rawtransaction.siacoinoutputs[k].value)
                            addressesImplicated.push({"hash": receiver2Hash, "sc": receiver2Amount})
                            totalSCtransacted = totalSCtransacted + receiver2Amount
                        }
                    }
                    // Synonyms on the sender TX
                    synonymHahses.push(apiblock.transactions[i].id)
                }
            }
        }
    }
    if (senderFound == false) { 
        // In SFs, there are rare cases of TX composed by one TX and not two (no auxiliary address). I haven't seen them in SC, but just in case:
        // Here, the sender info is in the receiver TX
        for (var j = 0; j < apiblock.transactions[n].siacoininputoutputs.length; j++) { // in case of several inputs
            var senderHash = apiblock.transactions[n].siacoininputoutputs[j].unlockhash
            var senderAmount = parseInt(apiblock.transactions[n].siacoininputoutputs[j].value) * -1
            addressesImplicated.push({"hash": senderHash, "sc": senderAmount})
        }
    }
    
    // Adding the fees to the total transacted
    totalSCtransacted = totalSCtransacted + minerFees

    // Saving the data in SQL Insert queries
    // Tx type
    if (hostAnnouncementBool == false) { // Conventional TX
        for (var m = 0; m < synonymHahses.length; m++) {
            var toAddHashTypes = "('" + synonymHahses[m] + "','ScTx','" + masterHash + "')"
            newSql.push(SqlFunctions.insertSql("HashTypes", toAddHashTypes, synonymHahses[m]))
        }
        // Tx Info
        var toAddTxInfo = "('" + masterHash + "','" + synonymHahses + "'," + height + "," + timestamp + "," + minerFees + ")"
        newSql.push(SqlFunctions.insertSql("TxInfo", toAddTxInfo, masterHash))
        // Saving TX as a component of a block
        var toAddBlockTransactions = "(" + height + ",'" + masterHash + "','ScTx'," + totalSCtransacted + ",0)"
        newSql.push(SqlFunctions.insertSql("BlockTransactions", toAddBlockTransactions, masterHash))

    } else { // Host announcement
        for (var m = 0; m < synonymHahses.length; m++) {
            var toAddHashTypes = "('" + synonymHahses[m] + "','host ann','" + masterHash + "')"
            newSql.push(SqlFunctions.insertSql("HashTypes", toAddHashTypes, synonymHahses[m]))
        }
        
        // Tx Info
        var toAddHostAnnInfo = "('" + masterHash + "','" + synonymHahses + "'," + height + "," + timestamp + "," + minerFees + ",'" + decodedIp + "')"
        newSql.push(SqlFunctions.insertSql("HostAnnInfo", toAddHostAnnInfo, masterHash))
        // Saving TX as a component of a block
        var toAddBlockTransactions = "(" + height + ",'" + masterHash + "','host ann'," + totalSCtransacted + ",0)"
        newSql.push(SqlFunctions.insertSql("BlockTransactions", toAddBlockTransactions, masterHash))
    }

    var addressesAux = []
    for (var m = 0; m < addressesImplicated.length; m++) {
        // Address changes
        if (hostAnnouncementBool == false) { // Conventional SC transaction
            var toAddAddressChanges = "('" + addressesImplicated[m].hash + "','" + masterHash + "'," + addressesImplicated[m].sc + 
                ",0," + height + "," + timestamp + ",'ScTx')"
        } else { // Host announcement
            var toAddAddressChanges = "('" + addressesImplicated[m].hash + "','" + masterHash + "'," + addressesImplicated[m].sc + 
                ",0," + height + "," + timestamp + ",'host ann')"
        }
        var checkString = addressesImplicated[m].hash + "' and MasterHash='" + masterHash 
        newSql.push(SqlFunctions.insertSql("AddressChanges", toAddAddressChanges, checkString))
        
        // Saving used addressed in a temporal array, as they need to be de-duplicated at the end of the block
        if (addressesImplicated[m].sc > 0) { // Only receivers' addresses need to be incorporate to the database, as senders should be already from a previous block
            addressesAux.push(addressesImplicated[m].hash)
        }
    }

    // I return 2 elements
    var returnArray = [newSql, addressesAux, txsIndexed]
    return returnArray
}


exports.scSingleTransaction = function(apiblock, n, height, timestamp) {
    // Special cases of transactions not paying miner fees. Only happens in pool payouts of certain mining pools
    var totalSCtransacted = 0
    var addressesImplicated = []
    var synonymHahses = []
    var hostAnnouncementBool = false
    var newSql = []

    // Receivers info
    for (var i = 0; i < apiblock.transactions[n].rawtransaction.siacoinoutputs.length; i++) { // in case of several receivers
        var receiverHash = apiblock.transactions[n].rawtransaction.siacoinoutputs[i].unlockhash
        var receiverAmount = parseInt(apiblock.transactions[n].rawtransaction.siacoinoutputs[i].value)
        totalSCtransacted = totalSCtransacted + receiverAmount
        
        // In case of several outputs being received by the same address: we add the amounts ro the first entry if the same address appears again
        var receiverRepeatedBool = false
        for (k = 0; k < addressesImplicated.length; k++) {
            if (receiverHash == addressesImplicated[k].hash) { // Merging amounts
                addressesImplicated[k].sc = addressesImplicated[k].sc + receiverAmount
                receiverRepeatedBool = true
            }
        }
        if (receiverRepeatedBool == false) { // If address not repeated, then add the operation
            addressesImplicated.push({"hash": receiverHash, "sc": receiverAmount})
        }
    }

    // Senders
    for (var j = 0; j < apiblock.transactions[n].siacoininputoutputs.length; j++) { // in case of several receivers
        var senderHash = apiblock.transactions[n].siacoininputoutputs[j].unlockhash
        var senderAmount = parseInt(apiblock.transactions[n].siacoininputoutputs[j].value) * -1
        // In case of multiple outputs coming from the same address, like in defrag operations
        var senderRepeatedBool = false
        for (k = 0; k < addressesImplicated.length; k++) {
            if (senderHash == addressesImplicated[k].hash) { // Merging amounts
                addressesImplicated[k].sc = addressesImplicated[k].sc + senderAmount
                senderRepeatedBool = true
            }
        }
        if (senderRepeatedBool == false) { // If address not repeated, then add the operation
            addressesImplicated.push({"hash": senderHash, "sc": senderAmount})
        }
    }

    // MasterHash as synonym
    synonymHahses.push(apiblock.transactions[n].id)
    var minerFees = 0 // It is an empty array, but I want to make clear this TX did not paid fees
    var masterHash = apiblock.transactions[n].id // I abitrarily decide the receiver's TX hash is the "Master Hash" (as in the SiaUI) (different from SF operations, legacy reasons)


    // Saving the data in SQL Insert queries
    // Tx type
    for (var m = 0; m < synonymHahses.length; m++) {
        var toAddHashTypes = "('" + synonymHahses[m] + "','ScTx','" + masterHash + "')"
        newSql.push(SqlFunctions.insertSql("HashTypes", toAddHashTypes, synonymHahses[m]))
    }
    
    // Tx Info
    var toAddTxInfo = "('" + masterHash + "','" + synonymHahses + "'," + height + "," + timestamp + "," + minerFees + ")"
    newSql.push(SqlFunctions.insertSql("TxInfo", toAddTxInfo, masterHash))
    
    // Saving TX as a component of a block
    var toAddBlockTransactions = "(" + height + ",'" + masterHash + "','ScTx'," + totalSCtransacted + ",0)"
    newSql.push(SqlFunctions.insertSql("BlockTransactions", toAddBlockTransactions, masterHash))

    var addressesAux = []
    for (var m = 0; m < addressesImplicated.length; m++) {
        // Address changes
        if (hostAnnouncementBool == false) { // Conventional SC transaction
            var toAddAddressChanges = "('" + addressesImplicated[m].hash + "','" + masterHash + "'," + addressesImplicated[m].sc + 
                ",0," + height + "," + timestamp + ",'ScTx')"
        } else { // Host announcement
            var toAddAddressChanges = "('" + addressesImplicated[m].hash + "','" + masterHash + "'," + addressesImplicated[m].sc + 
                ",0," + height + "," + timestamp + ",'host ann')"
        }
        var checkString = addressesImplicated[m].hash + "' and MasterHash='" + masterHash 
        newSql.push(SqlFunctions.insertSql("AddressChanges", toAddAddressChanges, checkString))
        
        // Saving used addressed in a temporal array, as they need to be de-duplicated at the end of the block
        addressesAux.push(addressesImplicated[m].hash)
    }

    // I return 2 elements
    var returnArray = [newSql, addressesAux]
    return returnArray
}


exports.addressesSave = function(totalAddresses) {
    var newSql = []

    // Sorting and deleting duplicates among the addresses, to save them as hash types
    totalAddresses.sort()
    for (var o = 0; o < totalAddresses.length; o++) {
        if (totalAddresses[o] == totalAddresses[o-1]) {
            totalAddresses.splice(o,1)
            o--
        }
    } 

    // Addresses as hash types
    for (var p = 0; p < totalAddresses.length; p++) {
        var toAddHashTypes = "('" + totalAddresses[p] + "','address','')"
        newSql.push(SqlFunctions.insertSql("HashTypes", toAddHashTypes, totalAddresses[p]))
    }

    return newSql
}
