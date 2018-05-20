// ==================================
//      FILE CONTRACT OPERATIONS
// ==================================

var exports = module.exports={}

// Load external modules
var SqlFunctions = require('../modules/sqlfunctions.js')

exports.fileContractsProcess = function(apiblock, n, height, timestamp) {
    // File contracts are composed of 3 transactions: a renter operation, a host operation and the contract formation (in this order). I am treating them 
    // as 3 independent objects in the blockchain, even if the outputs of the first are just "intermediate addresses", as the renter's transactions are daisy chained
    // into multiple file contracts in the same block

    var addressesAux = []
    var newSql = []
    var txsIndexed = []
    txsIndexed.push(n)
    var tx = apiblock.transactions[n] // To facilitate the syntax

    // THE CONTRACT ITSELF:
    var masterHash = tx.id
    var minerFees = parseInt(tx.rawtransaction.minerfees[0])
    var revisionNumber = parseInt(tx.rawtransaction.filecontracts[0].revisionnumber)
    var windowStart = parseInt(tx.rawtransaction.filecontracts[0].windowstart) // Block that opens the window for submitting the storage proof
    var windowEnd = parseInt(tx.rawtransaction.filecontracts[0].windowend)
    var fileSize = parseInt(tx.rawtransaction.filecontracts[0].filesize) // Contract size in current revision
    if (fileSize == 0) { 
        var renewBool = 0 // Boolean (bit in SQL) to mark this contract is a renewal
    } else {
        var renewBool = 1
    }
    var contractId = tx.filecontractids[0]


    if (tx.rawtransaction.siacoininputs.length >= 2) {
        // This is for conventional contracts of nowadays rules
        // First, we identify the renter and the host transactions, and process them in a separate function
        var link = []
        link[0] = tx.rawtransaction.siacoininputs[0].parentid // Renter TX
        link[1] = tx.rawtransaction.siacoininputs[1].parentid // Host TX
        

        // Finding the matching transactions
        for (i = 0; i < link.length; i++) { // For both links
            var matchBool = false
            for (m = 0; m < apiblock.transactions.length; m++) { // Iterate on each transaction
            if ( apiblock.transactions[m].siacoinoutputids != null) { // To avoid errors, as some TXs don't have siacoin outputs 
                    if (link[i] == apiblock.transactions[m].siacoinoutputids[0]) {
                        matchBool = true // Boolean to mark we found the matching TX
                        var linkId = ""
                        if (i == 0) { // Renter TX=
                            linkId = "allowancePost"  // Renter
                        } else {
                            linkId = "collateralPost" // Host
                        }
                        txsIndexed.push(m) // Marking TX as indexed
                        // In top of processing the TX, it saves the addresses used in "the returnArray" to later avoid race conditions saving addresses as hash types
                        var returnArray = contractPreTx(apiblock.transactions[m], height, timestamp, linkId, contractId)
                        // returnArray contains: 0- a sub-array of addresses, 1- The masterHash of the preTx, 2- The linkId 3- new SQL queries
                        var newAddresses = returnArray[0]
                        for (var j = 0; j < newAddresses.length; j++) {
                            addressesAux.push(newAddresses[j]) // Saves addresses in addresesAux
                        }
                        if (returnArray[2] == "allowancePost") {
                            var allowancePostingHash = returnArray[1]
                        } else if (returnArray[2] == "collateralPost") {
                            var collateralPostingHash = returnArray[1]
                        }
                        newSql = newSql.concat(returnArray[3])
                    }
                }
            }
            if (matchBool == false) {
                // If a match was not found. This is because there is a small percentage of cases where the 3 transactions are in 2 different blocks
                // This is because F2pool is only including blocks without TX fees, so they will add the renter and host posting, but not the contract, that will go
                // in the next block. Sometimes one is missing, some others, the two of them
                // In these cases, as I have to link something for reference, instead of the Hash of those TX, I show the intermediate address: that will link the 2 transactions if a user is browsing
                // It is probably an imperfect solution, but I consider it is valid for a user
                
                if (i == 0) { // Renter TX
                    var allowancePostingHash = tx.siacoininputoutputs[0].unlockhash
                } else { // Host TX
                    var collateralPostingHash = tx.siacoininputoutputs[1].unlockhash
                }
            }     
        } 
        var renterAllowanceValue = parseInt(tx.siacoininputoutputs[0].value)
        var renterAllowanceSender = tx.siacoininputoutputs[0].unlockhash
        var hostCollateralValue = parseInt(tx.siacoininputoutputs[1].value)
        var hostCollateralSender = tx.siacoininputoutputs[1].unlockhash
        var totalTransacted = renterAllowanceValue + hostCollateralValue

        // Storage proof outputs:
        var validProof1Value = tx.rawtransaction.filecontracts[0].validproofoutputs[0].value
        var validProof1Address = tx.rawtransaction.filecontracts[0].validproofoutputs[0].unlockhash
        var validProof2Value = tx.rawtransaction.filecontracts[0].validproofoutputs[1].value
        var validProof2Address = tx.rawtransaction.filecontracts[0].validproofoutputs[1].unlockhash
        var missedProof1Value = tx.rawtransaction.filecontracts[0].missedproofoutputs[0].value
        var missedProof1Address = tx.rawtransaction.filecontracts[0].missedproofoutputs[0].unlockhash
        var missedProof2Value = tx.rawtransaction.filecontracts[0].missedproofoutputs[1].value
        var missedProof2Address = tx.rawtransaction.filecontracts[0].missedproofoutputs[1].unlockhash
        var missedProof3Value = tx.rawtransaction.filecontracts[0].missedproofoutputs[2].value
        var missedProof3Address = tx.rawtransaction.filecontracts[0].missedproofoutputs[2].unlockhash

        // Address changes
        var toAddAddressChanges = "('" + renterAllowanceSender + "','" + masterHash + "',-" + renterAllowanceValue + 
            ",0," + height + "," + timestamp + ",'contractform')"
        var checkString = renterAllowanceSender + "' and MasterHash='" + masterHash
        newSql.push(SqlFunctions.insertSql("AddressChanges", toAddAddressChanges, checkString))
        var toAddAddressChanges = "('" + hostCollateralSender + "','" + masterHash + "',-" + hostCollateralValue + 
            ",0," + height + "," + timestamp + ",'contractform')"
        var checkString = hostCollateralSender + "' and MasterHash='" + masterHash
        newSql.push(SqlFunctions.insertSql("AddressChanges", toAddAddressChanges, checkString))

    } else if (tx.rawtransaction.siacoininputs.length == 1) {
        // EXCEPTIONS:
        // On the early days of Sia, looks like the file contracts had very different rules. Looking at the first file contract at block #1008, there was a single
        // validproofoutput (contract payout for host) and a single missedproof. There was a single input (renter?). 
        // On block 21243 some contracts appear with 2 valid outputs but only 2 missed outputs (renter + burnt)
        // This code accounts for theses exceptions:
        var allowancePostingHash = tx.siacoininputoutputs[0].unlockhash
        var collateralPostingHash = "Unknown (legacy contract)"
        var renterAllowanceSender = tx.siacoininputoutputs[0].unlockhash
        var renterAllowanceValue = parseInt(tx.siacoininputoutputs[0].value)
        var hostCollateralValue = 0
        var hostCollateralSender = "Unknown (legacy contract)"
        var totalTransacted = renterAllowanceValue
        if (minerFees > 0) {} else {minerFees = 0}

        // Storage proof outputs:
        if (tx.rawtransaction.filecontracts[0].missedproofoutputs.length == 1) { // Ultra-old contracts (1 valid, 1 missed)
            var validProof1Value = 0
            var validProof1Address = "Unexistent (legacy contract)"
            var validProof2Value = tx.rawtransaction.filecontracts[0].validproofoutputs[0].value
            var validProof2Address = tx.rawtransaction.filecontracts[0].validproofoutputs[0].unlockhash
            var missedProof1Value = 0
            var missedProof1Address = "Unexistent (legacy contract)"
            var missedProof2Value = 0
            var missedProof2Address = "Unexistent (legacy contract)"
            var missedProof3Value = tx.rawtransaction.filecontracts[0].missedproofoutputs[0].value
            var missedProof3Address = tx.rawtransaction.filecontracts[0].missedproofoutputs[0].unlockhash
        } else if (tx.rawtransaction.filecontracts[0].missedproofoutputs.length == 2) { // Old contracts (2 missed, 2 valid)
            var validProof1Value = tx.rawtransaction.filecontracts[0].validproofoutputs[0].value
            var validProof1Address = tx.rawtransaction.filecontracts[0].validproofoutputs[0].unlockhash
            var validProof2Value = tx.rawtransaction.filecontracts[0].validproofoutputs[1].value
            var validProof2Address = tx.rawtransaction.filecontracts[0].validproofoutputs[1].unlockhash
            var missedProof1Value = tx.rawtransaction.filecontracts[0].missedproofoutputs[0].value
            var missedProof1Address = tx.rawtransaction.filecontracts[0].missedproofoutputs[0].unlockhash
            var missedProof2Value = 0
            var missedProof2Address = "Unexistent (legacy contract)"
            var missedProof3Value = tx.rawtransaction.filecontracts[0].missedproofoutputs[1].value
            var missedProof3Address = tx.rawtransaction.filecontracts[0].missedproofoutputs[1].unlockhash
        } else { // Current-structure contracts with 2 valid and 3 missed
            var validProof1Value = tx.rawtransaction.filecontracts[0].validproofoutputs[0].value
            var validProof1Address = tx.rawtransaction.filecontracts[0].validproofoutputs[0].unlockhash
            var validProof2Value = tx.rawtransaction.filecontracts[0].validproofoutputs[1].value
            var validProof2Address = tx.rawtransaction.filecontracts[0].validproofoutputs[1].unlockhash
            var missedProof1Value = tx.rawtransaction.filecontracts[0].missedproofoutputs[0].value
            var missedProof1Address = tx.rawtransaction.filecontracts[0].missedproofoutputs[0].unlockhash
            var missedProof2Value = tx.rawtransaction.filecontracts[0].missedproofoutputs[1].value
            var missedProof2Address = tx.rawtransaction.filecontracts[0].missedproofoutputs[1].unlockhash
            var missedProof3Value = tx.rawtransaction.filecontracts[0].missedproofoutputs[2].value
            var missedProof3Address = tx.rawtransaction.filecontracts[0].missedproofoutputs[2].unlockhash
        }
        // Address changes
        var toAddAddressChanges = "('" + renterAllowanceSender + "','" + masterHash + "',-" + renterAllowanceValue + 
            ",0," + height + "," + timestamp + ",'contractform')"
        var checkString = renterAllowanceSender + "' and MasterHash='" + masterHash
        newSql.push(SqlFunctions.insertSql("AddressChanges", toAddAddressChanges, checkString))
    }
    

    // TxID and contractID as a hash type (both can be searched as synonyms)
    var toAddHashTypes = "('" + masterHash + "','contract','" + masterHash + "')"
    newSql.push(SqlFunctions.insertSql("HashTypes", toAddHashTypes, masterHash))
    var toAddHashTypes2 = "('" + contractId + "','contract','" + masterHash + "')"
    newSql.push(SqlFunctions.insertSql("HashTypes", toAddHashTypes2, contractId))
 
    // Tx inside a block
    var toAddBlockTransactions = "(" + height + ",'" + masterHash + "','contract'," + totalTransacted + ",0)"
    newSql.push(SqlFunctions.insertSql("BlockTransactions", toAddBlockTransactions, masterHash))
 
    // Contract info
    var toAddContractInfo = "('" + masterHash + "','" + contractId + "','" + allowancePostingHash + "'," + renterAllowanceValue + ",'" 
        + collateralPostingHash + "'," + hostCollateralValue + "," + minerFees + "," + windowStart + "," + windowEnd + "," 
        + revisionNumber + "," + fileSize + "," + fileSize + ",'" + validProof1Address + "'," + validProof1Value + ",'" + validProof2Address + "'," 
        + validProof2Value + ",'" + missedProof1Address + "'," + missedProof1Value + ",'" + missedProof2Address + "'," + missedProof2Value + ",'" 
        + missedProof3Address + "'," + missedProof3Value + "," + height + "," + timestamp + ",'ongoing'," + renewBool + ")"
    newSql.push(SqlFunctions.insertSql("ContractInfo", toAddContractInfo, masterHash))
    
    // I return both the newSql queries and the addressesAux
    var returnArray = [newSql, addressesAux, txsIndexed]
    return returnArray
}


function contractPreTx(tx, height, timestamp, linkId, contractId) {
    // This function saves the two transactions previous to the contract formation (one from host, one from renter)
    // as "collateral posting" and "allowance posting" types
    
    // Senders
    var addressesImplicated = []
    var newSql = []
    var totalTransacted = 0
    for (var j = 0; j < tx.siacoininputoutputs.length; j++) { // in case of several inputs addresses
        var senderHash = tx.siacoininputoutputs[j].unlockhash
        var senderAmount = (tx.siacoininputoutputs[j].value) * -1
        addressesImplicated.push({"hash": senderHash, "sc": senderAmount, "type": linkId})
    }

    // Receivers
    for (var k = 0; k < tx.rawtransaction.siacoinoutputs.length; k++) { // in case of several outputs addresses
        var receiverHash = tx.rawtransaction.siacoinoutputs[k].unlockhash
        var receiverAmount = parseInt(tx.rawtransaction.siacoinoutputs[k].value)
        if (k == 0) { // Marks this output as money for the contract formation: ads a different "color" to the address change operation
            addressesImplicated.push({"hash": receiverHash, "sc": receiverAmount, "type": "contractform"})
        } else { // Stays either as a "collateralPost" or "allowancePost"
            addressesImplicated.push({"hash": receiverHash, "sc": receiverAmount, "type": linkId})
        }
        totalTransacted = totalTransacted + receiverAmount
    }

    // Tx as a hash type
    var masterHash = tx.id
    var toAddHashTypes = "('" + masterHash + "','" + linkId + "','" + masterHash + "')"
    newSql.push(SqlFunctions.insertSql("HashTypes", toAddHashTypes, masterHash))

    // Tx inside a block
    var toAddBlockTransactions = "(" + height + ",'" + masterHash + "','" + linkId + "'," + totalTransacted + ",0)"
    newSql.push(SqlFunctions.insertSql("BlockTransactions", toAddBlockTransactions, masterHash))

    // Tx info
    // The field "synonyms" includes only the contractId to link this TX to the contract created
    var toAddTxInfo = "('" + masterHash + "','" + contractId + "'," + height + "," + timestamp + ",0)"
    newSql.push(SqlFunctions.insertSql("TxInfo", toAddTxInfo, masterHash))

    // Address changes
    var addressesAux = []
    for (var i = 0; i < addressesImplicated.length; i++) {
        var toAddAddressChanges = "('" + addressesImplicated[i].hash + "','" + masterHash + "'," + addressesImplicated[i].sc + 
            ",0," + height + "," + timestamp + ",'" + addressesImplicated[i].type + "')"
        var checkString = addressesImplicated[i].hash + "' and MasterHash='" + masterHash
        newSql.push(SqlFunctions.insertSql("AddressChanges", toAddAddressChanges, checkString))

        // Saving used addressed in a temporal array, as they need to be de-duplicated at the end of the block
        if (addressesImplicated[i].sc > 0) { // Only receivers' addresses need to be incorporate to the database, as senders should be already from a previous block
            addressesAux.push(addressesImplicated[i].hash)
        }
    }

    // Return the new addresses used, to include them later as HashTypes
    var returnArray = [addressesAux, masterHash, linkId, newSql]
    return returnArray
}


exports.revisionProcess = function(apiblock, n, height, timestamp) {
    var totalTransacted = 0
    var addressesImplicated = []
    var addressesAux = []
    var newSql = []
    var txsIndexed = []
    txsIndexed.push(n) // Marking as indexed
    var tx = apiblock.transactions[n] // To facilitate the syntax
    var masterHash = tx.id
    var synonymHash
    var contractId = tx.rawtransaction.filecontractrevisions[0].parentid
    var newRevision = parseInt(tx.rawtransaction.filecontractrevisions[0].newrevisionnumber)
    var newFileSize = parseInt(tx.rawtransaction.filecontractrevisions[0].newfilesize)
    
    // Storage proof outputs:
    if (tx.rawtransaction.filecontractrevisions[0].newmissedproofoutputs.length > 2) { // Nowaday's revisions
        var minerFees = parseInt(tx.rawtransaction.minerfees[0])

        var validProof1Value = tx.rawtransaction.filecontractrevisions[0].newvalidproofoutputs[0].value
        var validProof1Address = tx.rawtransaction.filecontractrevisions[0].newvalidproofoutputs[0].unlockhash
        var validProof2Value = tx.rawtransaction.filecontractrevisions[0].newvalidproofoutputs[1].value
        var validProof2Address = tx.rawtransaction.filecontractrevisions[0].newvalidproofoutputs[1].unlockhash
        var missedProof1Value = tx.rawtransaction.filecontractrevisions[0].newmissedproofoutputs[0].value
        var missedProof1Address = tx.rawtransaction.filecontractrevisions[0].newmissedproofoutputs[0].unlockhash
        var missedProof2Value = tx.rawtransaction.filecontractrevisions[0].newmissedproofoutputs[1].value
        var missedProof2Address = tx.rawtransaction.filecontractrevisions[0].newmissedproofoutputs[1].unlockhash
        var missedProof3Value = tx.rawtransaction.filecontractrevisions[0].newmissedproofoutputs[2].value
        var missedProof3Address = tx.rawtransaction.filecontractrevisions[0].newmissedproofoutputs[2].unlockhash

        // Finding the linked TX (the sending TX)
        var matcher = tx.rawtransaction.siacoininputs[0].parentid
        var senderSc = []
        var senderAddress = []
        for (m = 0; m < apiblock.transactions.length; m++) { // Iterate on each transaction
            if ( apiblock.transactions[m].siacoinoutputids != null) { // To avoid errors, as some TXs don't have siacoin outputs 
                if (matcher == apiblock.transactions[m].siacoinoutputids[0]) {

                    synonymHash = apiblock.transactions[m].id
                    txsIndexed.push(m) // Marking as indexed
                    for (var j = 0; j < apiblock.transactions[m].siacoininputoutputs.length; j++) { // In case of multiple senders
                        senderAddress[j] = apiblock.transactions[m].siacoininputoutputs[j].unlockhash
                        senderSc[j] = parseInt(apiblock.transactions[m].siacoininputoutputs[j].value) * -1
                        addressesImplicated.push({"hash": senderAddress[j], "sc": senderSc[j]})

                        totalTransacted = totalTransacted + parseInt(apiblock.transactions[m].siacoininputoutputs[j].value)
                        // I don't save any address as hash type, as all of them are senders and should be already on the DB
                    }

                    // Receiver of the remaining funds returning to the wallet (it is just one, the other output are the mining fees)
                    // EXCEPTION: A very few number of transactions have no wallet return, the exact amount is sent as fees. 
                    // This if condition deals with this
                    if (apiblock.transactions[m].rawtransaction.siacoinoutputs.length > 1) {
                        var receiverAddress = apiblock.transactions[m].rawtransaction.siacoinoutputs[1].unlockhash
                        var receiverSc = parseInt(apiblock.transactions[m].rawtransaction.siacoinoutputs[1].value)
                        addressesImplicated.push({"hash": receiverAddress, "sc": receiverSc})
                        addressesAux.push(receiverAddress) // Saving it in this temp array to later be pushed as a hash type in the main loop of navigator.js
                    }
                }
            }
        }
    } else {
        // EXCEPTION: 
        // "Legacy revisions" with two valid output and just two missed outputs. THi first missed output is the amount returned to renter and the second is
        // sent to be burnt
        var validProof1Value = tx.rawtransaction.filecontractrevisions[0].newvalidproofoutputs[0].value
        var validProof1Address = tx.rawtransaction.filecontractrevisions[0].newvalidproofoutputs[0].unlockhash
        var validProof2Value = tx.rawtransaction.filecontractrevisions[0].newvalidproofoutputs[1].value
        var validProof2Address = tx.rawtransaction.filecontractrevisions[0].newvalidproofoutputs[1].unlockhash
        var missedProof1Value = tx.rawtransaction.filecontractrevisions[0].newmissedproofoutputs[0].value
        var missedProof1Address = tx.rawtransaction.filecontractrevisions[0].newmissedproofoutputs[0].unlockhash
        var missedProof2Value = 0
        var missedProof2Address = "Unexistent (lagacy contract)"
        var missedProof3Value = tx.rawtransaction.filecontractrevisions[0].newmissedproofoutputs[1].value
        var missedProof3Address = tx.rawtransaction.filecontractrevisions[0].newmissedproofoutputs[1].unlockhash
        var synonymHash = ""
        totalTransacted = 0
        var minerFees = 0
    }

    // SAVING IN SQL 
    // Tx and synonym as a hash types
    var toAddHashTypes = "('" + masterHash + "','revision','" + masterHash + "')"
    newSql.push(SqlFunctions.insertSql("HashTypes", toAddHashTypes, masterHash))
    var toAddHashTypes2 = "('" + synonymHash + "','revision','" + masterHash + "')"
    newSql.push(SqlFunctions.insertSql("HashTypes", toAddHashTypes2, masterHash))
    
    // Tx inside a block
    var toAddBlockTransactions = "(" + height + ",'" + masterHash + "','revision'," + totalTransacted + ",0)"
    newSql.push(SqlFunctions.insertSql("BlockTransactions", toAddBlockTransactions, masterHash))
    
    // Revision info
    // The field "synonyms" includes only the contractId to link this TX to the contract created
    var toAddRevisionInfo = "('" + masterHash + "','" + contractId + "'," + minerFees + "," 
        + newRevision + "," + newFileSize + ",'" + validProof1Address + "'," + validProof1Value + ",'" + validProof2Address + "'," 
        + validProof2Value + ",'" + missedProof1Address + "'," + missedProof1Value + ",'" + missedProof2Address + "'," + missedProof2Value + ",'" 
        + missedProof3Address + "'," + missedProof3Value + "," + height + "," + timestamp + ",'" + synonymHash + "')"
    newSql.push(SqlFunctions.insertSql("RevisionsInfo", toAddRevisionInfo, masterHash))

    // Address changes
    for (var i = 0; i < addressesImplicated.length; i++) {
        var toAddAddressChanges = "('" + addressesImplicated[i].hash + "','" + masterHash + "'," + addressesImplicated[i].sc + 
            ",0," + height + "," + timestamp + ",'revision')"
        var checkString = addressesImplicated[i].hash + "' and MasterHash='" + masterHash
        newSql.push(SqlFunctions.insertSql("AddressChanges", toAddAddressChanges, checkString))
    }

    // Updating the contract with the new data
    var toUpdateContract = "RevisionNum = " + newRevision + ", CurrentFileSize = " + newFileSize + ", ValidProof1Address = '" + validProof1Address
        + "', ValidProof1Value = " + validProof1Value + ", ValidProof2Address = '" + validProof2Address + "', ValidProof2Value = " + validProof2Value
        + ", MissedProof1Address = '" + missedProof1Address + "', MissedProof1Value = " + missedProof1Value + ", MissedProof2Address = '" + missedProof2Address 
        + "', MissedProof2Value = " + missedProof2Value + ", MissedProof3Address = '" + missedProof3Address + "', MissedProof3Value = " + missedProof3Value
    newSql.push(SqlFunctions.insertSql("ReviseContract", toUpdateContract, contractId))

    var returnArray = [newSql, addressesAux, txsIndexed]
    return returnArray
}


exports.proofProcess = function(apiblock, n, height, timestamp) {
    // For storage proofs, I am calling the 2 transactions as 2 catergories: the "senderTX" will be called the "storage proof", while the second TX
    // is being called "Contract resolution", successful. I am adding an artificial TX: "contract resolution", failed, for contracts without a proof uploaded
    
    var addressesAux = []
    var newSql = []
    var txsIndexed = []
    txsIndexed.push(n) // Marking as indexed
    var addressesImplicated = []
    var totalTransacted = 0
    var tx = apiblock.transactions[n] // To facilitate the syntax
    var minerFees = parseInt(tx.rawtransaction.minerfees[0])
    var masterHash = tx.id
    var contractId = tx.rawtransaction.storageproofs[0].parentid
    var result = "success"

    if (tx.storageproofoutputs[0].length > 1) { // Nowaday's storage proofs

        var output0Address = tx.storageproofoutputs[0][0].unlockhash
        var output0Value = parseInt(tx.storageproofoutputs[0][0].value)
        var output1Address = tx.storageproofoutputs[0][1].unlockhash
        var output1Value = parseInt(tx.storageproofoutputs[0][1].value)
        totalTransacted = output0Value + output1Value
        // Pushing output addresses to be saved as Hash types
        addressesAux.push(output0Address)
        addressesAux.push(output1Address)
        
        // Finding the linked TX (the sending TX)
        if (tx.rawtransaction.siacoininputs.length > 0) { // Modern transactions, paying fees
            var matcher = tx.rawtransaction.siacoininputs[0].parentid
            for (m = 0; m < apiblock.transactions.length; m++) { // Iterate on each transaction
                if ( apiblock.transactions[m].siacoinoutputids != null) { // To avoid errors, as some TXs don't have siacoin outputs 
                    if (matcher == apiblock.transactions[m].siacoinoutputids[0]) {
                        txsIndexed.push(m)
                        var returnArray = proofPostingTx(apiblock.transactions[m], height, timestamp, minerFees, contractId)
                        // returnArray contains: 1- the hash of the Proof posting tx, 2- addresses used, 3- SQL queries
                        var proofPostingHash = returnArray[1]
                        var newaddresses = returnArray[0]
                        addressesAux.push(newaddresses)
                        newSql = newSql.concat(returnArray[2])
                    }
                }
            }
        } else {
            // Yet another EXCEPTION: Proof posting with 2 outputs but not yet paying fees in a previous transaction
            var proofPostingHash = ""
            var minerFees = 0
        }
        
        // Synonyms
        var synonyms = []
        synonyms.push(masterHash)
        synonyms.push(extraHash)

        // ContractResolution info
        var toAddContractResolution = "('" + masterHash + "','" + contractId + "'," + minerFees + ",'" + result + "'," + height + "," + timestamp + ",'"
            + output0Address + "'," + output0Value + ",'" + output1Address + "'," + output1Value + ",null,null,'" + proofPostingHash + "','" + synonyms + "')" 
        newSql.push(SqlFunctions.insertSql("ContractResolutions", toAddContractResolution, masterHash))

        // Address changes
        var toAddAddressChanges = "('" + output0Address + "','" + masterHash + "'," + output0Value + 
            ",0," + height + "," + timestamp + ",'contractresol')"
        var checkString = output0Address + "' and MasterHash='" + masterHash
        newSql.push(SqlFunctions.insertSql("AddressChanges", toAddAddressChanges, checkString))
        
        var toAddAddressChanges2 = "('" + output1Address + "','" + masterHash + "'," + output1Value + 
            ",0," + height + "," + timestamp + ",'contractresol')"
        var checkString2 = output1Address + "' and MasterHash='" + masterHash
        newSql.push(SqlFunctions.insertSql("AddressChanges", toAddAddressChanges2, checkString2))     

    } else {
        // EXCEPTION: 
        // Legacy contracts, with just one output from the contract, going to the host. No pre-Tx (proof of storage)
        var output1Address = tx.storageproofoutputs[0][0].unlockhash
        var output1Value = parseInt(tx.storageproofoutputs[0][0].value)
        var output0Address = "Unexistent (legacy contract)"
        var output0Value = 0
        addressesAux.push(output1Address)
        var synonyms = []
        synonyms.push(masterHash)
        var totalTransacted = output1Value

        // ContractResolution info
        var toAddContractResolution = "('" + masterHash + "','" + contractId + "',0,'" + result + "'," + height + "," + timestamp + ",'"
        + output0Address + "'," + output0Value + ",'" + output1Address + "'," + output1Value + ",null,null,'','" + synonyms + "')" 
        newSql.push(SqlFunctions.insertSql("ContractResolutions", toAddContractResolution, masterHash))

        // Address change
        var toAddAddressChanges2 = "('" + output1Address + "','" + masterHash + "'," + output1Value + 
        ",0," + height + "," + timestamp + ",'contractresol')"
        var checkString2 = output1Address + "' and MasterHash='" + masterHash
        newSql.push(SqlFunctions.insertSql("AddressChanges", toAddAddressChanges2, checkString2))

    }

    // Tx as a hash type
    var toAddHashTypes = "('" + masterHash + "','contractresol','" + masterHash + "')"
    newSql.push(SqlFunctions.insertSql("HashTypes", toAddHashTypes, masterHash))

    // I add an artificial type of hash: the contractId ending on R for the resolution. I replace the last character. This is for consistency reasons with failed contracts
    var extraHash = contractId.slice(0,63) + "R"
    var toAddHashTypes = "('" + extraHash + "','contractresol','" + masterHash + "')"
    newSql.push(SqlFunctions.insertSql("HashTypes", toAddHashTypes, extraHash))

    // Tx inside a block
    var toAddBlockTransactions = "(" + height + ",'" + masterHash + "','contractresol'," + totalTransacted + ",0)"
    newSql.push(SqlFunctions.insertSql("BlockTransactions", toAddBlockTransactions, masterHash))

    // Updating contract with the result
    var toUpdateContract = "Status = 'complete-succ'"
    newSql.push(SqlFunctions.insertSql("ReviseContract", toUpdateContract, contractId))

    var returnArray = [newSql, addressesAux, txsIndexed]
    return returnArray
}


function proofPostingTx(tx, height, timestamp, minerFees, contractId) {
    
    var addressesImplicated = []
    var newSql = []
    var totalTransacted = 0
    var masterHash = tx.id
    
    // Senders
    for (var j = 0; j < tx.siacoininputoutputs.length; j++) { // in case of several inputs addresses
        var senderHash = tx.siacoininputoutputs[j].unlockhash
        var senderAmount = parseInt(tx.siacoininputoutputs[j].value) * -1
        addressesImplicated.push({"hash": senderHash, "sc": senderAmount})
        totalTransacted = totalTransacted + tx.siacoininputoutputs[j].value
    }
    
    // Receiver: only the second output (wallet return), as the first are the miner fees
    var receiverHash = tx.rawtransaction.siacoinoutputs[1].unlockhash
    var receiverAmount = parseInt(tx.rawtransaction.siacoinoutputs[1].value)
    addressesImplicated.push({"hash": receiverHash, "sc": receiverAmount})

    // Tx as a hash type
    var toAddHashTypes = "('" + masterHash + "','storageproof','" + masterHash + "')"
    newSql.push(SqlFunctions.insertSql("HashTypes", toAddHashTypes, masterHash))

    // Tx inside a block
    var toAddBlockTransactions = "(" + height + ",'" + masterHash + "','storageproof'," + totalTransacted + ",0)"
    newSql.push(SqlFunctions.insertSql("BlockTransactions", toAddBlockTransactions, masterHash))

    // Tx info
    // The field "synonyms" includes only the contractId to link this TX to the contract created
    var toAddTxInfo = "('" + masterHash + "','" + contractId + "'," + height + "," + timestamp + "," + minerFees +")"
    newSql.push(SqlFunctions.insertSql("TxInfo", toAddTxInfo, masterHash))

    // Address changes
    for (var i = 0; i < addressesImplicated.length; i++) {
        var toAddAddressChanges = "('" + addressesImplicated[i].hash + "','" + masterHash + "'," + addressesImplicated[i].sc + 
            ",0," + height + "," + timestamp + ",'storageproof')"
        var checkString = addressesImplicated[i].hash + "' and MasterHash='" + masterHash
        newSql.push(SqlFunctions.insertSql("AddressChanges", toAddAddressChanges, checkString))
    }

    // The only address to return is the Receiver Hash (senders should be already in the DB)
    var returnHash = [receiverHash, masterHash, newSql]
    return returnHash
}


exports.failedContract = function(conditions, timestamp) {
    // Saves the contract as failed and distributes the outputs. remember THIS IS AN ARTIFICIAL TX meant to simulate the consensus rules when a contract fails

    var newSql = []
    var masterHash = conditions.contractId.slice(0,63) + "R" // I am creating this artificial hash type, where I replace the last character by an "R"
    var height = parseInt(conditions.end) + 1 // The block height is the next one to the end of the Window for sending a proof (this is a convention I am using)
    var totalTransacted = conditions.value1 + conditions.value2 + conditions.value3
    var synonyms = masterHash

    // Tx as a hash type
    var toAddHashTypes = "('" + masterHash + "','contractresol','" + masterHash + "')"
    newSql.push(SqlFunctions.insertSql("HashTypes", toAddHashTypes, masterHash))

    // Tx inside a block
    var toAddBlockTransactions = "(" + height + ",'" + masterHash + "','contractresol'," + totalTransacted + ",0)"
    newSql.push(SqlFunctions.insertSql("BlockTransactions", toAddBlockTransactions, masterHash))

    // ContractResolution info
    // The field "synonyms" includes only the contractId to link this TX to the contract created
    var toAddContractResolution = "('" + masterHash + "','" + conditions.contractId + "',0,'fail'," + height + "," + timestamp + ",'"
        + conditions.address1 + "'," + conditions.value1 + ",'" + conditions.address2 + "'," + conditions.value2 + ",'" + conditions.address3 + "'," + conditions.value3 + ",null,'" + synonyms + "')" 
    newSql.push(SqlFunctions.insertSql("ContractResolutions", toAddContractResolution, masterHash))

    // Address changes
    if (conditions.value1 != 0) { // This avoids saving an empty address change in Legacy contracts, where only funds are sent to be burnt
        var toAddAddressChanges = "('" + conditions.address1 + "','" + masterHash + "'," + conditions.value1 + 
            ",0," + height + "," + conditions.timestamp + ",'contractresol')"
        var checkString = conditions.address1 + "' and MasterHash='" + masterHash
        newSql.push(SqlFunctions.insertSql("AddressChanges", toAddAddressChanges, checkString))
    }

    if (conditions.value2 != 0) { // This avoids saving an empty address change in Legacy contracts, where only funds are sent to be burnt
        var toAddAddressChanges2 = "('" + conditions.address2 + "','" + masterHash + "'," + conditions.value2 + 
            ",0," + height + "," + conditions.timestamp + ",'contractresol')"
        var checkString2 = conditions.address2 + "' and MasterHash='" + masterHash
        newSql.push(SqlFunctions.insertSql("AddressChanges", toAddAddressChanges2, checkString2))
    }

    if (conditions.value3 != 0) { // Only add this change in the burn address if something was sent for burning
        var toAddAddressChanges3 = "('" + conditions.address3 + "','" + masterHash + "'," + conditions.value3 + 
            ",0," + height + "," + conditions.timestamp + ",'contractresol')"
        var checkString3 = conditions.address3 + "' and MasterHash='" + masterHash
        newSql.push(SqlFunctions.insertSql("AddressChanges", toAddAddressChanges3, checkString3))
    }
    
    // Updating contract with the result
    var toUpdateContract = "Status = 'complete-fail'"
    newSql.push(SqlFunctions.insertSql("ReviseContract", toUpdateContract, conditions.contractId))

    // Output address as a hash types
    if (conditions.value1 != 0) { // This avoids saving an empty address change in Legacy contracts, where only funds are sent to be burn
        var toAddHashTypes = "('" + conditions.address1 + "','address','')"
        newSql.push(SqlFunctions.insertSql("HashTypes", toAddHashTypes, conditions.address1))
    }
    if (conditions.value1 != 0) { // This avoids saving an empty address change in Legacy contracts, where only funds are sent to be burn
        var toAddHashTypes = "('" + conditions.address2 + "','address','')"
        newSql.push(SqlFunctions.insertSql("HashTypes", toAddHashTypes, conditions.address2))
    }
    var toAddHashTypes = "('" + conditions.address3 + "','address','')"
    newSql.push(SqlFunctions.insertSql("HashTypes", toAddHashTypes, conditions.address3))

    // Instead of returning newSQL to the main loop, for simplicity I just make a new connection for all of these queries 
    // Creating the merged SQL operation and sending it to SQL
    var sqlQuery = ""
    for (var i = 0; i < newSql.length; i++) {
        var sqlQuery = sqlQuery + newSql[i] + " "
    }
    SqlFunctions.insertFinalSql(sqlQuery)
}
