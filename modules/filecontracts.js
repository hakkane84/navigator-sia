// File contracts indexing
var exports = module.exports={}
var SqlComposer = require("./sql_composer.js")
var SqlAsync = require('./sql_async.js')
var Outputs = require("./outputs.js")

exports.fileContractsProcess = function(params, apiblock, n, height, timestamp) {
    // File contracts are composed of 3 transactions: a renter operation, a host operation and the contract formation (in this order). I am treating them 
    // as 3 independent objects in the blockchain, even if the outputs of the first are just "intermediate addresses", as the renter's transactions are daisy chained
    // into multiple file contracts in the same block

    var addressesImplicated = []
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
                        var returnArray = contractPreTx(params, apiblock.transactions[m], height, timestamp, linkId, contractId)
                        // returnArray contains: 0- a sub-array of addresses, 1- The masterHash of the preTx, 2- The linkId 3- new SQL queries
                        addressesImplicated = addressesImplicated.concat(returnArray[0])
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
                // This is because F2pool for a time only included blocks without TX fees, so they will add the renter and host posting, but not the contract, that will go
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

        // Storage proof possible results:
        var validProof1Output = tx.rawtransaction.filecontracts[0].validproofoutputs[0].id
        var validProof1Value = tx.rawtransaction.filecontracts[0].validproofoutputs[0].value
        var validProof1Address = tx.rawtransaction.filecontracts[0].validproofoutputs[0].unlockhash
        var validProof2Output = tx.rawtransaction.filecontracts[0].validproofoutputs[1].id
        var validProof2Value = tx.rawtransaction.filecontracts[0].validproofoutputs[1].value
        var validProof2Address = tx.rawtransaction.filecontracts[0].validproofoutputs[1].unlockhash
        var missedProof1Output = tx.rawtransaction.filecontracts[0].missedproofoutputs[0].id
        var missedProof1Value = tx.rawtransaction.filecontracts[0].missedproofoutputs[0].value
        var missedProof1Address = tx.rawtransaction.filecontracts[0].missedproofoutputs[0].unlockhash
        var missedProof2Output = tx.rawtransaction.filecontracts[0].missedproofoutputs[1].id
        var missedProof2Value = tx.rawtransaction.filecontracts[0].missedproofoutputs[1].value
        var missedProof2Address = tx.rawtransaction.filecontracts[0].missedproofoutputs[1].unlockhash
        var missedProof3Output = tx.rawtransaction.filecontracts[0].missedproofoutputs[2].id
        var missedProof3Value = tx.rawtransaction.filecontracts[0].missedproofoutputs[2].value
        var missedProof3Address = tx.rawtransaction.filecontracts[0].missedproofoutputs[2].unlockhash

        // Address changes
        addressesImplicated.push({"hash": renterAllowanceSender, "sc": (renterAllowanceValue * (-1)), "masterHash": masterHash, "txType": "contractform"})
        addressesImplicated.push({"hash": hostCollateralSender, "sc": (hostCollateralValue * (-1)), "masterHash": masterHash, "txType": "contractform"})
        
        // Exception: some modern contracts have a renter-returning output. `us` contracts can do this
        if (tx.siacoinoutputs != null) {
            for (var i = 0; i < tx.siacoinoutputs.length; i++) {
                addressesImplicated.push({"hash": tx.siacoinoutputs[i].unlockhash, "sc": tx.siacoinoutputs[i].value, "masterHash": masterHash, "txType": "contractform"})
            }
        }
        
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
            var validProof1Output = ""
            var validProof1Value = 0
            var validProof1Address = "Unexistent (legacy contract)"
            var validProof2Output = tx.rawtransaction.filecontracts[0].validproofoutputs[0].id
            var validProof2Value = tx.rawtransaction.filecontracts[0].validproofoutputs[0].value
            var validProof2Address = tx.rawtransaction.filecontracts[0].validproofoutputs[0].unlockhash
            var missedProof1Output = ""
            var missedProof1Value = 0
            var missedProof1Address = "Unexistent (legacy contract)"
            var missedProof2Output = ""
            var missedProof2Value = 0
            var missedProof2Address = "Unexistent (legacy contract)"
            var missedProof3Output = tx.rawtransaction.filecontracts[0].missedproofoutputs[0].id
            var missedProof3Value = tx.rawtransaction.filecontracts[0].missedproofoutputs[0].value
            var missedProof3Address = tx.rawtransaction.filecontracts[0].missedproofoutputs[0].unlockhash
        } else if (tx.rawtransaction.filecontracts[0].missedproofoutputs.length == 2) { // Old contracts (2 missed, 2 valid)
            var validProof1Output = tx.rawtransaction.filecontracts[0].validproofoutputs[0].id
            var validProof1Value = tx.rawtransaction.filecontracts[0].validproofoutputs[0].value
            var validProof1Address = tx.rawtransaction.filecontracts[0].validproofoutputs[0].unlockhash
            var validProof2Output = tx.rawtransaction.filecontracts[0].validproofoutputs[1].id
            var validProof2Value = tx.rawtransaction.filecontracts[0].validproofoutputs[1].value
            var validProof2Address = tx.rawtransaction.filecontracts[0].validproofoutputs[1].unlockhash
            var missedProof1Output = tx.rawtransaction.filecontracts[0].missedproofoutputs[0].id
            var missedProof1Value = tx.rawtransaction.filecontracts[0].missedproofoutputs[0].value
            var missedProof1Address = tx.rawtransaction.filecontracts[0].missedproofoutputs[0].unlockhash
            var missedProof2Output = ""
            var missedProof2Value = 0
            var missedProof2Address = "Unexistent (legacy contract)"
            var missedProof3Output = tx.rawtransaction.filecontracts[0].missedproofoutputs[1].id
            var missedProof3Value = tx.rawtransaction.filecontracts[0].missedproofoutputs[1].value
            var missedProof3Address = tx.rawtransaction.filecontracts[0].missedproofoutputs[1].unlockhash
        } else { // Current-structure contracts with 2 valid and 3 missed
            var validProof1Output = tx.rawtransaction.filecontracts[0].validproofoutputs[0].id
            var validProof1Value = tx.rawtransaction.filecontracts[0].validproofoutputs[0].value
            var validProof1Address = tx.rawtransaction.filecontracts[0].validproofoutputs[0].unlockhash
            var validProof2Output = tx.rawtransaction.filecontracts[0].validproofoutputs[1].id
            var validProof2Value = tx.rawtransaction.filecontracts[0].validproofoutputs[1].value
            var validProof2Address = tx.rawtransaction.filecontracts[0].validproofoutputs[1].unlockhash
            var missedProof1Output = tx.rawtransaction.filecontracts[0].missedproofoutputs[0].id
            var missedProof1Value = tx.rawtransaction.filecontracts[0].missedproofoutputs[0].value
            var missedProof1Address = tx.rawtransaction.filecontracts[0].missedproofoutputs[0].unlockhash
            var missedProof2Output = tx.rawtransaction.filecontracts[0].missedproofoutputs[1].id
            var missedProof2Value = tx.rawtransaction.filecontracts[0].missedproofoutputs[1].value
            var missedProof2Address = tx.rawtransaction.filecontracts[0].missedproofoutputs[1].unlockhash
            var missedProof3Output = tx.rawtransaction.filecontracts[0].missedproofoutputs[2].id
            var missedProof3Value = tx.rawtransaction.filecontracts[0].missedproofoutputs[2].value
            var missedProof3Address = tx.rawtransaction.filecontracts[0].missedproofoutputs[2].unlockhash
        }

        // Address change
        addressesImplicated.push({"hash": renterAllowanceSender, "sc": (renterAllowanceValue * (-1)), "masterHash": masterHash, "txType": "contractform"})
    }
    

    // TxID and contractID as a hash type (both can be searched as synonyms)
    var toAddHashTypes = "('" + masterHash + "','contract','" + masterHash + "')"
    newSql.push(SqlComposer.InsertSql(params, "HashTypes", toAddHashTypes, masterHash))
    var toAddHashTypes2 = "('" + contractId + "','contract','" + masterHash + "')"
    newSql.push(SqlComposer.InsertSql(params, "HashTypes", toAddHashTypes2, contractId))
 
    // Tx inside a block
    var toAddBlockTransactions = "(" + height + ",'" + masterHash + "','contract'," + totalTransacted + ",0)"
    newSql.push(SqlComposer.InsertSql(params, "BlockTransactions", toAddBlockTransactions, masterHash))
 
    // Contract info
    if (windowStart > 2100000000 || windowEnd > 2100000000) {
        // A few contracts in the past where set with an expiration date height of 18446744073709538800. This is wrong, and will overflow
        // `int` limits of the database. We avoid indexing them
        //console.log("*** Ignoring the contract " + masterHash + " set to expire in billions of blocks into the future")
    } else {
        var toAddContractInfo = "('" + masterHash + "','" + contractId + "','" + allowancePostingHash + "'," + renterAllowanceValue + ",'" 
            + collateralPostingHash + "'," + hostCollateralValue + "," + minerFees + "," + windowStart + "," + windowEnd + "," 
            + revisionNumber + "," + fileSize + "," + fileSize + ",'"
            + validProof1Output + "','" + validProof1Address + "'," + validProof1Value + ",'"
            + validProof2Output + "','" + validProof2Address + "'," + validProof2Value + ",'" 
            + missedProof1Output + "','" + missedProof1Address + "'," + missedProof1Value + ",'" 
            + missedProof2Output + "','" + missedProof2Address + "'," + missedProof2Value + ",'" 
            + missedProof3Output + "','" + missedProof3Address + "'," + missedProof3Value + "," 
            + height + "," + timestamp + ",'ongoing'," + renewBool + ")"
        newSql.push(SqlComposer.InsertSql(params, "ContractInfo", toAddContractInfo, masterHash))
    }  

    // Adding extra info to the addresses changes
    for (var i = 0; i < addressesImplicated.length; i++) {
        addressesImplicated[i].sf = 0
    }
    
    // I return both the newSql queries and the addressesImplicated
    var returnArray = [
        newSql,
        txsIndexed, 
        addressesImplicated]
    return returnArray
}


function contractPreTx(params, tx, height, timestamp, linkId, contractId) {
    // This function saves the two transactions previous to the contract formation (one from host, one from renter)
    // as "collateral posting" and "allowance posting" types
    
    var addressesImplicated = []
    var newSql = []
    var totalTransacted = 0
    var masterHash = tx.id

    // Senders
    for (var j = 0; j < tx.siacoininputoutputs.length; j++) { // in case of several inputs addresses
        var senderHash = tx.siacoininputoutputs[j].unlockhash
        var senderAmount = (tx.siacoininputoutputs[j].value) * -1
        addressesImplicated.push({"hash": senderHash, "sc": senderAmount, "masterHash": masterHash, "txType": linkId})
    }

    // Receivers
    for (var k = 0; k < tx.rawtransaction.siacoinoutputs.length; k++) { // in case of several outputs addresses
        var receiverHash = tx.rawtransaction.siacoinoutputs[k].unlockhash
        var receiverAmount = parseInt(tx.rawtransaction.siacoinoutputs[k].value)
        if (k == 0) { // Marks this output as money for the contract formation: ads a different "color" to the address change operation
            addressesImplicated.push({"hash": receiverHash, "sc": receiverAmount, "masterHash": masterHash, "txType": "contractform"})
        } else { // Stays either as a "collateralPost" or "allowancePost"
            addressesImplicated.push({"hash": receiverHash, "sc": receiverAmount, "masterHash": masterHash, "txType": linkId})
        }
        totalTransacted = totalTransacted + receiverAmount
    }

    // Tx as a hash type
    var toAddHashTypes = "('" + masterHash + "','" + linkId + "','" + masterHash + "')"
    newSql.push(SqlComposer.InsertSql(params, "HashTypes", toAddHashTypes, masterHash))

    // Tx inside a block
    var toAddBlockTransactions = "(" + height + ",'" + masterHash + "','" + linkId + "'," + totalTransacted + ",0)"
    newSql.push(SqlComposer.InsertSql(params, "BlockTransactions", toAddBlockTransactions, masterHash))

    // Tx info
    // The field "synonyms" includes only the contractId to link this TX to the contract created
    var toAddTxInfo = "('" + masterHash + "','" + contractId + "'," + height + "," + timestamp + ",0)"
    newSql.push(SqlComposer.InsertSql(params, "TxInfo", toAddTxInfo, masterHash))

    // Return the new addresses used, to include them later as HashTypes
    var returnArray = [addressesImplicated, masterHash, linkId, newSql]
    return returnArray
}


exports.revisionProcess = function(params, apiblock, n, height, timestamp) {
    var totalTransacted = 0
    var addressesImplicated = []
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
    if (tx.rawtransaction.filecontractrevisions[0].newmissedproofoutputs.length > 2 || newRevision >= 18446744073709551616) { // Nowaday's revision formats
        
        if (tx.rawtransaction.minerfees.length == 0) {
            // Certain mining pools are accepting revisions not paying mining fees (example: block 240748)
            var minerFees = 0
        } else {
            // Normal Revisions paying fees
            var minerFees = parseInt(tx.rawtransaction.minerfees[0])
        }

        if (newRevision >= 18446744073709551616) {
            // If the revision number is Max Uint64, this is a "Renew and Clear" Revision style. This is a new format intriduced on 2020,
            // and they don't include a MissedOutpu3 (burnt coins), as this contract is agreed between host and renter to be succeded, and
            // will not even have an in-chain storage proof
            var validProof1Value = tx.rawtransaction.filecontractrevisions[0].newvalidproofoutputs[0].value
            var validProof1Address = tx.rawtransaction.filecontractrevisions[0].newvalidproofoutputs[0].unlockhash
            var validProof2Value = tx.rawtransaction.filecontractrevisions[0].newvalidproofoutputs[1].value
            var validProof2Address = tx.rawtransaction.filecontractrevisions[0].newvalidproofoutputs[1].unlockhash
            var missedProof1Value = tx.rawtransaction.filecontractrevisions[0].newmissedproofoutputs[0].value
            var missedProof1Address = tx.rawtransaction.filecontractrevisions[0].newmissedproofoutputs[0].unlockhash
            var missedProof2Value = tx.rawtransaction.filecontractrevisions[0].newmissedproofoutputs[1].value
            var missedProof2Address = tx.rawtransaction.filecontractrevisions[0].newmissedproofoutputs[1].unlockhash
            var missedProof3Value = 0
            var missedProof3Address = "Unexistent (renew and clear revision)"
            
            // In SQL Server, the INT type is 4 bytes instead of 8, so we have to change the revision number to avoid an overflow. We correct this
            // in the API server to ensure we deliver the actual max uint64
            if (params.useMsSqlServer == true) {
                newRevision = 2147483647
            }
            
        } else {
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
        }

        // Finding the linked TX (the sending TX)
        var matchBool = false
        if (tx.rawtransaction.siacoininputs.length != 0) { // Rare exception first seen on block 232606
            var matcher = tx.rawtransaction.siacoininputs[0].parentid
            var senderSc = []
            var senderAddress = []
            for (m = 0; m < apiblock.transactions.length; m++) { // Iterate on each transaction
                if ( apiblock.transactions[m].siacoinoutputids != null) { // To avoid errors, as some TXs don't have siacoin outputs 
                    if (matcher == apiblock.transactions[m].siacoinoutputids[0]) {
    
                        matchBool = true
                        synonymHash = apiblock.transactions[m].id
                        txsIndexed.push(m) // Marking as indexed
                        for (var j = 0; j < apiblock.transactions[m].siacoininputoutputs.length; j++) { // In case of multiple senders
                            senderAddress[j] = apiblock.transactions[m].siacoininputoutputs[j].unlockhash
                            senderSc[j] = parseInt(apiblock.transactions[m].siacoininputoutputs[j].value) * -1
                            addressesImplicated.push({"hash": senderAddress[j], "sc": senderSc[j]})
                            totalTransacted = totalTransacted + parseInt(apiblock.transactions[m].siacoininputoutputs[j].value)
                        }
    
                        // Receiver of the remaining funds returning to the wallet (it is just one, the other output are the mining fees)
                        // EXCEPTION: A very few number of transactions have no wallet return, the exact amount is sent as fees. 
                        // This if condition deals with this
                        if (apiblock.transactions[m].rawtransaction.siacoinoutputs.length > 1) {
                            var receiverAddress = apiblock.transactions[m].rawtransaction.siacoinoutputs[1].unlockhash
                            var receiverSc = parseInt(apiblock.transactions[m].rawtransaction.siacoinoutputs[1].value)
                            addressesImplicated.push({"hash": receiverAddress, "sc": receiverSc})
                        }
                    }
                }
            }
        } else {
            //console.log("**** Exception: File revision without siacoin inputs")
        }
        
        
        // EXCEPTION: Singlet transaction revisions, where the sender TX is in a different block. This is caused be the abnormal block structure
        // of certain mining pools and peridods of time
        if (matchBool == false) {
            synonymHash = ""
            if (tx.rawtransaction.siacoininputs.length != 0) { // Rare exception first seen on block 232606
                // Sender
                for (var j = 0; j < tx.siacoininputoutputs.length; j++) { // In case of multiple senders
                    senderAddress[j] = tx.siacoininputoutputs[j].unlockhash
                    senderSc[j] = parseInt(tx.siacoininputoutputs[j].value) * -1
                    addressesImplicated.push({"hash": senderAddress[j], "sc": senderSc[j]})
                    totalTransacted = totalTransacted + parseInt(tx.siacoininputoutputs[j].value)
                }
            }
        }

    } else {
        // EXCEPTION: 
        // "Legacy revisions" with two valid output and just two missed outputs. The first missed output is the amount returned to renter and the second is
        // sent to be burnt
        var validProof1Value = tx.rawtransaction.filecontractrevisions[0].newvalidproofoutputs[0].value
        var validProof1Address = tx.rawtransaction.filecontractrevisions[0].newvalidproofoutputs[0].unlockhash
        var validProof2Value = tx.rawtransaction.filecontractrevisions[0].newvalidproofoutputs[1].value
        var validProof2Address = tx.rawtransaction.filecontractrevisions[0].newvalidproofoutputs[1].unlockhash
        var missedProof1Value = tx.rawtransaction.filecontractrevisions[0].newmissedproofoutputs[0].value
        var missedProof1Address = tx.rawtransaction.filecontractrevisions[0].newmissedproofoutputs[0].unlockhash
        var missedProof2Value = 0
        var missedProof2Address = "Unexistent (legacy contract)"
        var missedProof3Value = tx.rawtransaction.filecontractrevisions[0].newmissedproofoutputs[1].value
        var missedProof3Address = tx.rawtransaction.filecontractrevisions[0].newmissedproofoutputs[1].unlockhash
        var synonymHash = ""
        totalTransacted = 0
        var minerFees = 0
    }

    // SAVING IN SQL 
    // Tx and synonym as a hash types
    var toAddHashTypes = "('" + masterHash + "','revision','" + masterHash + "')"
    newSql.push(SqlComposer.InsertSql(params, "HashTypes", toAddHashTypes, masterHash))
    if (synonymHash != "" && synonymHash != null) {
        var toAddHashTypes2 = "('" + synonymHash + "','revision','" + masterHash + "')"
        newSql.push(SqlComposer.InsertSql(params, "HashTypes", toAddHashTypes2, synonymHash))
    }
    
    // Tx inside a block
    var toAddBlockTransactions = "(" + height + ",'" + masterHash + "','revision'," + totalTransacted + ",0)"
    newSql.push(SqlComposer.InsertSql(params, "BlockTransactions", toAddBlockTransactions, masterHash))
    
    // Revision info. The field "synonyms" includes only the contractId to link this TX to the contract created
    var toAddRevisionInfo = "('" + masterHash + "','" + contractId + "'," + minerFees + "," 
        + newRevision + "," + newFileSize + ",'" + validProof1Address + "'," + validProof1Value + ",'" + validProof2Address + "'," 
        + validProof2Value + ",'" + missedProof1Address + "'," + missedProof1Value + ",'" + missedProof2Address + "'," + missedProof2Value + ",'" 
        + missedProof3Address + "'," + missedProof3Value + "," + height + "," + timestamp + ",'" + synonymHash + "')"
    newSql.push(SqlComposer.InsertSql(params, "RevisionsInfo", toAddRevisionInfo, masterHash))

    // Adding extra info to the addresses changes
    for (var i = 0; i < addressesImplicated.length; i++) {
        addressesImplicated[i].sf = 0
        addressesImplicated[i].masterHash = masterHash
        addressesImplicated[i].txType = "revision"
    }

    // Updating the contract with the new data
    var toUpdateContract = "RevisionNum = " + newRevision + ", CurrentFileSize = " + newFileSize + ", ValidProof1Address = '" + validProof1Address
        + "', ValidProof1Value = " + validProof1Value + ", ValidProof2Address = '" + validProof2Address + "', ValidProof2Value = " + validProof2Value
        + ", MissedProof1Address = '" + missedProof1Address + "', MissedProof1Value = " + missedProof1Value + ", MissedProof2Address = '" + missedProof2Address 
        + "', MissedProof2Value = " + missedProof2Value + ", MissedProof3Address = '" + missedProof3Address + "', MissedProof3Value = " + missedProof3Value
    newSql.push(SqlComposer.InsertSql(params, "ReviseContract", toUpdateContract, contractId))

    var returnArray = [newSql, txsIndexed, addressesImplicated]
    return returnArray
}


exports.proofProcess = function(params, apiblock, n, height, timestamp) {
    // Storage proofs. I merge "duet" transactions into a single object on my explorer, same as with the rest of SC transactions
    
    var newSql = []
    var txsIndexed = []
    txsIndexed.push(n) // Marking as indexed
    var addressesImplicated = []
    var totalTransacted = 0
    var tx = apiblock.transactions[n] // To facilitate the syntax
    var masterHash = tx.id
    var contractId = tx.rawtransaction.storageproofs[0].parentid
    var synonyms = masterHash

    // Finding the linked TX (the sending TX)
    if (tx.rawtransaction.siacoininputs.length > 0) { // Modern transactions, paying fees
        var minerFees = parseInt(tx.rawtransaction.minerfees[0])
        var matcher = tx.rawtransaction.siacoininputs[0].parentid
        for (m = 0; m < apiblock.transactions.length; m++) { // Iterate on each transaction
            if ( apiblock.transactions[m].siacoinoutputids != null) { // To avoid errors, as some TXs don't have siacoin outputs 
                if (matcher == apiblock.transactions[m].siacoinoutputids[0]) {
                    txsIndexed.push(m)
                    
                    extraTx = apiblock.transactions[m]
                    var extraHash = extraTx.id
                    synonyms = synonyms + ", " + extraHash
                    
                    // Senders
                    for (var j = 0; j < extraTx.siacoininputoutputs.length; j++) { // in case of several inputs addresses
                        var senderHash = extraTx.siacoininputoutputs[j].unlockhash
                        var senderAmount = parseInt(extraTx.siacoininputoutputs[j].value) * -1
                        addressesImplicated.push({"hash": senderHash, "sc": senderAmount})
                    }
                    
                    // Receiver: only the second output (wallet return), as the first are the miner fees
                    var receiverHash = extraTx.rawtransaction.siacoinoutputs[1].unlockhash
                    var receiverAmount = parseInt(extraTx.rawtransaction.siacoinoutputs[1].value)
                    addressesImplicated.push({"hash": receiverHash, "sc": receiverAmount})
                    totalTransacted = minerFees + receiverAmount

                    // Connected transaction ID as a hash type
                    var toAddHashTypes = "('" + extraHash + "','storageproof','" + masterHash + "')"
                    newSql.push(SqlComposer.InsertSql(params, "HashTypes", toAddHashTypes, extraHash))

                }
            }
        }
    } else {
        // EXCEPTION: Proof posting with 2 outputs but not yet paying fees in a previous transaction
        var minerFees = 0
    }
    
    // MasterHash as hash type
    var toAddHashTypes = "('" + masterHash + "','storageproof','" + masterHash + "')"
    newSql.push(SqlComposer.InsertSql(params, "HashTypes", toAddHashTypes, masterHash))
    
    // Tx inside a block
    var toAddBlockTransactions = "(" + height + ",'" + masterHash + "','storageproof'," + totalTransacted + ",0)"
    newSql.push(SqlComposer.InsertSql(params, "BlockTransactions", toAddBlockTransactions, masterHash))

    // Tx in StorageProofsInfo
    var toAddStorageProofInfo = "('" + masterHash + "','" + contractId + "','" + synonyms + "'," + height + "," + timestamp + "," + minerFees + ")"
    newSql.push(SqlComposer.InsertSql(params, "StorageProofsInfo", toAddStorageProofInfo, masterHash))

    // Additional information for addressesImplicated
    for (var i = 0; i < addressesImplicated.length; i++) {
        addressesImplicated[i].sf = 0
        addressesImplicated[i].masterHash = masterHash
        addressesImplicated[i].txType = "storageproof"
    }

    var returnArray = [newSql, txsIndexed, addressesImplicated]
    return returnArray
}


exports.contractResolutions = async function(params, height, timestamp) {
    // Checks the contracts expiring in this block (their end height is this block) and resolves them as either
    // succeded or failed
    var sqlBatch = []
    var addressesImplicated = []

    // Checking expiring contracts, joined to their storage proofs (or not). If there is an storage proof associated, we identify it
    // because there is a MasterHash value in the returned query result
    var sqlQuery = "SELECT ContractInfo.ContractId, ContractInfo.RevisionNum,"
        + " ContractInfo.ValidProof1Output, ContractInfo.ValidProof1Address, ContractInfo.ValidProof1Value,"
        + " ContractInfo.ValidProof2Output, ContractInfo.ValidProof2Address, ContractInfo.ValidProof2Value,"
        + " ContractInfo.MissedProof1Output, ContractInfo.MissedProof1Address, ContractInfo.MissedProof1Value,"
        + " ContractInfo.MissedProof2Output, ContractInfo.MissedProof2Address, ContractInfo.MissedProof2Value,"
        + " ContractInfo.MissedProof3Output, ContractInfo.MissedProof3Address, ContractInfo.MissedProof3Value,"   
        + " StorageProofsInfo.MasterHash"
        + " FROM ContractInfo LEFT JOIN StorageProofsInfo ON ContractInfo.ContractId=StorageProofsInfo.ContractId" 
        + " WHERE ContractInfo.WindowEnd=" + height
    var result = await SqlAsync.Sql(params, sqlQuery)

    for (var i = 0; i < result.length; i++) {
        // Iterates on each expiring contract
        var status = "fail" // Default
        var resolveAs = "fail"

        // 1 - Universal rule for success: valid[1] = missed[1]
        // HOWEVER: Even if it is a success, it resolves outputs as if failed
        if (result[i].ValidProof2Value == result[i].MissedProof2Value) {
            status = "success"
            resolveAs = "fail"
        }

        // 2 - Second rule: there is an storage proof
        if (result[i].MasterHash != null) {
            status = "success"
            resolveAs = "success"
        }
        
        // Operations common to both succeded and failed contracts
        // Artificial hash: the contractId ending on R for the resolution, replacing the last character (so it fits the char(64) in the database)
        var resolutionId = result[i].ContractId.slice(0,63) + "R"
        var toAddHashTypes = "('" + resolutionId + "','contractresol','" + resolutionId + "')"
        sqlBatch.push(SqlComposer.InsertSql(params, "HashTypes", toAddHashTypes, resolutionId))

        // Tx inside a block
        if (result[i].ValidProof2Value == null) { result[i].ValidProof2Value = 0}
        var totalTransacted = result[i].ValidProof1Value + result[i].ValidProof2Value
        var toAddBlockTransactions = "(" + height + ",'" + resolutionId + "','contractresol'," + totalTransacted + ",0)"
        sqlBatch.push(SqlComposer.InsertSql(params, "BlockTransactions", toAddBlockTransactions, resolutionId))

        // Operations depending on the result
        if (status == "success") {
            // Succeded contracts
            // Updating contract with the result
            var toUpdateContract = "Status = 'complete-succ'"
            sqlBatch.push(SqlComposer.InsertSql(params, "ReviseContract", toUpdateContract, result[i].ContractId))

            // ContractResolution table entry
            var toAddContractResolution = "('" + resolutionId + "','" + result[i].ContractId + "',0,'" + status + "'," + height + "," + timestamp + ",'"
                + result[i].ValidProof1Address + "'," + result[i].ValidProof1Value + ",'" + result[i].ValidProof2Address + "'," + result[i].ValidProof2Value
                + ",null,null)" 
            sqlBatch.push(SqlComposer.InsertSql(params, "ContractResolutions", toAddContractResolution, resolutionId))

        } else { // Failed contracts
            
            // Updating contract with the result
            var toUpdateContract = "Status = 'complete-fail'"
            sqlBatch.push(SqlComposer.InsertSql(params, "ReviseContract", toUpdateContract, result[i].ContractId))

            // ContractResolution table entry
            var toAddContractResolution = "('" + resolutionId + "','" + result[i].ContractId + "',0,'" + status + "'," + height + "," + timestamp + ",'"
                + result[i].MissedProof1Address + "'," + result[i].MissedProof1Value + ",'" + result[i].MissedProof2Address + "'," + result[i].MissedProof2Value
                + ",'" + result[i].MissedProof3Address + "'," + result[i].MissedProof3Value + ")" 
            sqlBatch.push(SqlComposer.InsertSql(params, "ContractResolutions", toAddContractResolution, resolutionId))

        }


        // Resolving outputs
        // Resolve a success
        if (resolveAs == "success") {
            // Addresses changes
            addressesImplicated.push({
                "hash": result[i].ValidProof1Address, 
                "sc": result[i].ValidProof1Value,
                "sf": 0,
                "masterHash": resolutionId,
                "txType": "contractresol"
            })
            if (result[i].ValidProof2Value != 0 && result[i].ValidProof2Value != null) {
                addressesImplicated.push({
                    "hash": result[i].ValidProof2Address, 
                    "sc": result[i].ValidProof2Value,
                    "sf": 0,
                    "masterHash": resolutionId,
                    "txType": "contractresol"
                })
            }

            // Created outputs
            sqlBatch = Outputs.ContractResolutionOutputs(params, height, sqlBatch,
                result[i].ValidProof1Output, result[i].ValidProof1Address, result[i].ValidProof1Value)
            sqlBatch = Outputs.ContractResolutionOutputs(params, height, sqlBatch,
                result[i].ValidProof2Output, result[i].ValidProof2Address, result[i].ValidProof2Value)

                
        // Resolve a failure
        } else {
            // Addresses changes
            addressesImplicated.push({
                "hash": result[i].MissedProof1Address, 
                "sc": result[i].MissedProof1Value,
                "sf": 0,
                "masterHash": resolutionId,
                "txType": "contractresol"
            })
            if (result[i].MissedProof2Value != 0 && result[i].MissedProof2Value != null) {
                addressesImplicated.push({
                    "hash": result[i].MissedProof2Address, 
                    "sc": result[i].MissedProof2Value,
                    "sf": 0,
                    "masterHash": resolutionId,
                    "txType": "contractresol"
                })
            }
            if (result[i].MissedProof3Value != 0 && result[i].MissedProof3Value != null) {
                addressesImplicated.push({
                    "hash": result[i].MissedProof3Address, 
                    "sc": result[i].MissedProof3Value,
                    "sf": 0,
                    "masterHash": resolutionId,
                    "txType": "contractresol"
                })
            }

            // Created outputs
            sqlBatch = Outputs.ContractResolutionOutputs(params, height, sqlBatch,
                result[i].MissedProof1Output, result[i].MissedProof1Address, result[i].MissedProof1Value) 
            sqlBatch = Outputs.ContractResolutionOutputs(params, height, sqlBatch,
                result[i].MissedProof2Output, result[i].MissedProof2Address, result[i].MissedProof2Value)
            sqlBatch = Outputs.ContractResolutionOutputs(params, height, sqlBatch,
                result[i].MissedProof3Output, result[i].MissedProof3Address, result[i].MissedProof3Value)
        }

    }

    return [sqlBatch, addressesImplicated]
}
