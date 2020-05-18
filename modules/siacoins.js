// Indexes Siacoin operations
var exports = module.exports={}
var SqlComposer = require("./sql_composer.js")

exports.scTransactionProcess = function(params, apiblock, n, height, timestamp) {
    
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
    }

    // Adding the fees to the total transacted
    totalSCtransacted = totalSCtransacted + minerFees

    // Saving the data in SQL Insert queries
    // Tx type
    if (hostAnnouncementBool == false) { // Conventional TX
        for (var m = 0; m < synonymHahses.length; m++) {
            var toAddHashTypes = "('" + synonymHahses[m] + "','ScTx','" + masterHash + "')"
            newSql.push(SqlComposer.InsertSql(params, "HashTypes", toAddHashTypes, synonymHahses[m]))
        }
        // Tx Info
        var toAddTxInfo = "('" + masterHash + "','" + synonymHahses + "'," + height + "," + timestamp + "," + minerFees + ")"
        newSql.push(SqlComposer.InsertSql(params, "TxInfo", toAddTxInfo, masterHash))
        // Saving TX as a component of a block
        var toAddBlockTransactions = "(" + height + ",'" + masterHash + "','ScTx'," + totalSCtransacted + ",0)"
        newSql.push(SqlComposer.InsertSql(params, "BlockTransactions", toAddBlockTransactions, masterHash))

    } else { // Host announcement
        for (var m = 0; m < synonymHahses.length; m++) {
            var toAddHashTypes = "('" + synonymHahses[m] + "','host ann','" + masterHash + "')"
            newSql.push(SqlComposer.InsertSql(params, "HashTypes", toAddHashTypes, synonymHahses[m]))
        }
        
        // Tx Info
        var toAddHostAnnInfo = "('" + masterHash + "','" + synonymHahses + "'," + height + "," + timestamp + "," + minerFees + ",'" + decodedIp + "')"
        newSql.push(SqlComposer.InsertSql(params, "HostAnnInfo", toAddHostAnnInfo, masterHash))
        // Saving TX as a component of a block
        var toAddBlockTransactions = "(" + height + ",'" + masterHash + "','host ann'," + totalSCtransacted + ",0)"
        newSql.push(SqlComposer.InsertSql(params, "BlockTransactions", toAddBlockTransactions, masterHash))        
    }

    for (var m = 0; m < addressesImplicated.length; m++) {
        // Adding necessary fields
        addressesImplicated[m].masterHash = masterHash
        addressesImplicated[m].sf = 0

        // If it was a host announcement, add it
        if (hostAnnouncementBool == true) {
            addressesImplicated[m].txType = "host ann"
        }
    }

    // I return 3 elements
    var returnArray = [newSql, txsIndexed, addressesImplicated]
    return returnArray
}


exports.scSingleTransaction = function(params, apiblock, n, height, timestamp) {
    // Special cases of transactions not paying miner fees. Only happens in pool payouts of certain mining pools
    var totalSCtransacted = 0
    var addressesImplicated = []
    var synonymHahses = []
    var hostAnnouncementBool = false
    var newSql = []
    var masterHash = apiblock.transactions[n].id
    var minerFees = 0 // It is an empty array, but I want to make clear this TX did not paid fees

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
            addressesImplicated.push({"hash": receiverHash, "sc": receiverAmount, "sf": 0, "masterHash": masterHash})
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
            addressesImplicated.push({"hash": senderHash, "sc": senderAmount, "sf": 0, "masterHash": masterHash})
        }
    }

    // Saving the data in SQL Insert queries
    // Tx type
    var toAddHashTypes = "('" + masterHash + "','ScTx','" + masterHash + "')"
    newSql.push(SqlComposer.InsertSql(params, "HashTypes", toAddHashTypes, masterHash))
    
    // Tx Info
    var toAddTxInfo = "('" + masterHash + "','" + synonymHahses + "'," + height + "," + timestamp + "," + minerFees + ")"
    newSql.push(SqlComposer.InsertSql(params, "TxInfo", toAddTxInfo, masterHash))
    
    // Saving TX as a component of a block
    var toAddBlockTransactions = "(" + height + ",'" + masterHash + "','ScTx'," + totalSCtransacted + ",0)"
    newSql.push(SqlComposer.InsertSql(params, "BlockTransactions", toAddBlockTransactions, masterHash))

    // I return 2 elements
    var returnArray = [newSql, addressesImplicated]
    return returnArray
}


exports.legacyHostAnnouncements = function(params, api, i, height, timestamp, sqlBatch) {
    // Some very old transactions anounce a host without paying miner fees or transacting a single siacoin
    // NOTE: strikingly, the same Tx Hash announcing the same host (legacy) can appear in multiple blocks. For SQL database compatibility,
    // and due to the small value of presenting these multiple transactions, I am not making an exception that allows duplicated hashes

    var masterHash = api.transactions[i].id
    var hostIp = api.transactions[i].arbitrarydata[0]
    
    // Format 1: SG9zdEFubm91bmNlbWVudBEAAAAAAAAAMzcuNTkuMzcuMTg1Ojk5ODI=
    // Format 2: SG9zdEFubm91bmNlbWVudBAAAAAAAAAAOTkuNTYuOC4xNTI6OTk4Mg==
    var s = hostIp.search("NlbWVud")
    hostIp = hostIp.slice(s+18)
    if (hostIp.slice(0, 10) == "bmFyd2FsIH") {
        // It is a Narwal wallet announcement, ignore it
    } else {
        var decodedIp = Buffer.from(hostIp, 'base64').toString('ascii')
        
        // Tx as a hash type
        var toAddHashTypes = "('" + masterHash + "','host ann','" + masterHash + "')"
        sqlBatch.push(SqlComposer.InsertSql(params, "HashTypes", toAddHashTypes, masterHash))

        // Host announcement info Info
        var toAddHostAnnInfo = "('" + masterHash + "',''," + height + "," + timestamp + ",0,'" + decodedIp + "')"
        sqlBatch.push(SqlComposer.InsertSql(params, "HostAnnInfo", toAddHostAnnInfo, masterHash))

        // TX as a component of a block
        var toAddBlockTransactions = "(" + height + ",'" + masterHash + "','host ann',0,0)"
        sqlBatch.push(SqlComposer.InsertSql(params, "BlockTransactions", toAddBlockTransactions, masterHash))
    }

    // No change in the balance of any address in these transactions, we just return sqlBatch
    return sqlBatch
}