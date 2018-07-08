
// ===================================
//            SQL FUNCTIONS
// ===================================

var exports = module.exports={}

var FileContracts = require('./filecontracts.js')

var sql = require('C:/nodejs/node_modules/mssql');
var fs = require('fs');

// Parameters for accessing the SQL database (Customize also in ../navigator.js)
var sqlLogin = { 
    server: 'localhost',
    database: 'navigator',
    user: 'your_user', // CHANGE THIS
    password: 'your_password', // CHANGE THIS
    port: 1433,
    connectionTimeout: 60000,
    requestTimeout: 60000,
    pool: {
        max: 100,
        min: 0,
        idleTimeoutMillis: 30000
    }
};



exports.insertSql= function(table, toAdd, toCheck) {
    // Constructing the SQL query, depending on the table to update. It returns the sentence, so it can be added to the batch of sencences of a block
    if (table == "BlockInfo") {
        var sqlQuery = "IF NOT EXISTS (SELECT Height FROM BlockInfo WHERE Height = " + toCheck
            + ") INSERT INTO BlockInfo (Height,Timestamp,TransactionCount,Hash,MinerPayoutAddress,MinerArbitraryData,Difficulty,Hashrate,"
            + "TotalCoins,SiacoinInputCount,SiacoinOutputCount,FileContractRevisionCount,StorageProofCount,SiafundInputCount,SiafundOutputCount,"
            + "ActiveContractCost,ActiveContractCount,ActiveContractSize,TotalContractCost,TotalContractCount,TotalContractSize,NewContracts,NewTx,MiningPool,FeeCount"
            + ") VALUES " + toAdd
    } else if (table == "HashTypes") {
        var sqlQuery = "IF NOT EXISTS (SELECT Hash FROM HashTypes WHERE Hash = '" + toCheck
            + "') INSERT INTO HashTypes (Hash,Type,MasterHash) VALUES " + toAdd 
    } else if (table == "AddressChanges") {
        var sqlQuery = "IF NOT EXISTS (SELECT Address FROM AddressChanges WHERE Address = '" + toCheck
            + "') INSERT INTO AddressChanges (Address,MasterHash,ScChange,SfChange,Height,Timestamp,TxType) VALUES " + toAdd
    } else if (table == "TxInfo") {
        var sqlQuery = "IF NOT EXISTS (SELECT TxHash FROM TxInfo WHERE TxHash = '" + toCheck
            + "') INSERT INTO TxInfo (TxHash,HashSynonyms,Height,Timestamp,Fees) VALUES " + toAdd
    } else if (table == "BlockTransactions") {
        var sqlQuery = "IF NOT EXISTS (SELECT Height FROM BlockTransactions WHERE TxHash = '" + toCheck
            + "') INSERT INTO BlockTransactions (Height,TxHash,TxType,TotalAmountSc,TotalAmountSf) VALUES " + toAdd
    } else if (table == "HostAnnInfo") {
        var sqlQuery = "IF NOT EXISTS (SELECT TxHash FROM HostAnnInfo WHERE TxHash = '" + toCheck
            + "') INSERT INTO HostAnnInfo (TxHash,HashSynonyms,Height,Timestamp,Fees,IP) VALUES " + toAdd
    } else if (table == "ContractInfo") {
        var sqlQuery = "IF NOT EXISTS (SELECT MasterHash FROM ContractInfo WHERE MasterHash = '" + toCheck
            + "') INSERT INTO ContractInfo (MasterHash,ContractId,AllowancePosting,RenterValue,CollateralPosting,HostValue,Fees,WindowStart,WindowEnd," 
            + "RevisionNum,OriginalFileSize,CurrentFileSize,ValidProof1Address,ValidProof1Value,ValidProof2Address,ValidProof2Value," 
            + "MissedProof1Address,MissedProof1Value,MissedProof2Address,MissedProof2Value,MissedProof3Address,MissedProof3Value,Height,Timestamp,Status,Renew)" 
            + " VALUES " + toAdd
    } else if (table == "RevisionsInfo") {
        var sqlQuery = "IF NOT EXISTS (SELECT MasterHash FROM RevisionsInfo WHERE MasterHash = '" + toCheck
            + "') INSERT INTO RevisionsInfo (MasterHash,ContractId,Fees," 
            + "NewRevisionNum,NewFileSize,ValidProof1Address,ValidProof1Value,ValidProof2Address,ValidProof2Value," 
            + "MissedProof1Address,MissedProof1Value,MissedProof2Address,MissedProof2Value,MissedProof3Address,MissedProof3Value,Height,Timestamp,HashSynonyms)"
            + " VALUES " + toAdd
    } else if (table == "ContractResolutions") {
        var sqlQuery = "IF NOT EXISTS (SELECT MasterHash FROM ContractResolutions WHERE MasterHash = '" + toCheck
            + "') INSERT INTO ContractResolutions (MasterHash,ContractId,Fees,Result,Height,Timestamp," 
            + "Output0Address,Output0Value,Output1Address,Output1Value,Output2Address,Output2Value, ProofPostingHash, Synonyms)"
            + " VALUES " + toAdd 
    } else if (table == "ReviseContract") { // This is not a table, but instead a calln to update a current contract
        var sqlQuery = "UPDATE ContractInfo SET " + toAdd + " WHERE ContractId = '" + toCheck + "'"
    }

    // Returns the constructed sentence
    return sqlQuery

}

exports.insertFinalSql= function(sqlQuery) {
    // This SQL request adds the info only if no entry exists for the checked condition
    var dbConn = new sql.ConnectionPool(sqlLogin);
    dbConn.connect().then(function () {
        var request = new sql.Request(dbConn);
        request.query(sqlQuery).then(function (recordSet) {
            //console.log(recordSet);
            dbConn.close();
            
        }).catch(function (err) {
            //console.log(err);
            console.log("//////////// The block could not be batch-indexed. Initiating its itemized indexing")
            dbConn.close();
            itemizedIndexing(sqlBatch)
        });
    }).catch(function (err) {
        console.log(err);
    });
}



exports.resolveFailedContracts = function(currentBlock, currentTimestamp) {

    // 1 - Querying OLD contracts still running
    var dbConn = new sql.ConnectionPool(sqlLogin);
    dbConn.connect().then(function () {
        var request = new sql.Request(dbConn);
        // This resolves a contract if the Window of the contract is finishes and still shows up as "ongoing" (this means there is no valid Proof of Storage)
        
        checkBlock = currentBlock - 1 // By doing this, I start scanning contracts 1 blocks after the en of the contract. This way, I want to prevent race
        // conditions where the Proof of Storage is not yet saved and the contract updated
        
        var query = "SELECT MasterHash,ContractId,WindowEnd,Timestamp,MissedProof1Address,MissedProof1Value,MissedProof2Address,MissedProof2Value,MissedProof3Address,"
            + "MissedProof3Value FROM ContractInfo WHERE WindowEnd = '" + checkBlock + "' AND Status = 'ongoing'"
        request.query(query).then(function (recordSet) {
            dbConn.close();
            
            if (recordSet.rowsAffected > 0) { // Only consider those queries with affected rows
                for (var n = 0; n < recordSet.recordset.length; n++) { // For each contract affected
                    
                    var contractAffected = recordSet.recordset[n]
                    // I don't need to update the missed outputs, as they should be already updated in the DB after the revision
                    var resolutionConditions = {"contractId": contractAffected.ContractId, "end": contractAffected.WindowEnd, "timestamp": contractAffected.Timestamp,
                        "address1": contractAffected.MissedProof1Address, "value1": contractAffected.MissedProof1Value,
                        "address2": contractAffected.MissedProof2Address, "value2": contractAffected.MissedProof2Value,
                        "address3": contractAffected.MissedProof3Address, "value3": contractAffected.MissedProof3Value,}
                        FileContracts.failedContract(resolutionConditions, currentTimestamp)
                }
            }
            
        }).catch(function (err) {
            console.log(err);
            dbConn.close();
        });
    }).catch(function (err) {
        console.log(err);
    });
}


exports.deleteBlocks = function(blocks) {
    // This SQL request deletes info contained in the "blocks" array of blocks

    console.log("Deleting blocks: " + blocks)
    var sqlQuery = ""
    for (var n = 0; n < blocks.length; n++) {
        sqlQuery = sqlQuery + " DELETE FROM AddressChanges WHERE Height=" + blocks[n]
            + " DELETE FROM BlockInfo WHERE Height=" + blocks[n]
            + " DELETE FROM BlockTransactions WHERE Height=" + blocks[n]
            + " DELETE FROM TxInfo WHERE Height=" + blocks[n]
            + " DELETE FROM HostAnnInfo WHERE Height=" + blocks[n]
            + " DELETE FROM ContractInfo WHERE Height=" + blocks[n]
            + " DELETE FROM RevisionsInfo WHERE Height=" + blocks[n]
            + " DELETE FROM ContractResolutions WHERE Height=" + blocks[n]
    }

    var dbConn = new sql.ConnectionPool(sqlLogin);
    dbConn.connect().then(function () {
        var request = new sql.Request(dbConn);
        request.query(sqlQuery).then(function (recordSet) {
            dbConn.close();

        }).catch(function (err) {
            console.log(err);
            dbConn.close();
        });
    }).catch(function (err) {
        //console.log(err);
    });
}


exports.lastTxsStats = function() {
    // First step for reteriving the last transaction of each type, shown in the landing page of Navigator: SC Transactions
    var sqlQuery = "SELECT Height, TxHash FROM BlockTransactions WHERE Height > 100000 AND TxType = 'ScTx' ORDER BY Height DESC OFFSET 10 ROWS FETCH NEXT 10 ROWS ONLY"
    var dbConn = new sql.ConnectionPool(sqlLogin);
    dbConn.connect().then(function () {
        var request = new sql.Request(dbConn);
        request.query(sqlQuery).then(function (recordSet) {
            dbConn.close();
            var landingArray = [{"last10ScTx": recordSet.recordset}]
            lastTxsStatsStep2(landingArray)
        }).catch(function (err) {
            console.log(err);
            dbConn.close();
        });
    }).catch(function (err) {});
}

function lastTxsStatsStep2 (landingArray) {
    // Second step: contract activity
    var sqlQuery = "SELECT Height, TxHash, TxType FROM BlockTransactions WHERE Height > 100000 AND (TxType = 'revision' OR TxType = 'contract' OR TxType = 'storageproof' OR TxType = 'contractresol') ORDER BY Height DESC OFFSET 10 ROWS FETCH NEXT 10 ROWS ONLY"
    var dbConn = new sql.ConnectionPool(sqlLogin);
    dbConn.connect().then(function () {
        var request = new sql.Request(dbConn);
        request.query(sqlQuery).then(function (recordSet) {
            dbConn.close();
            landingArray.push({"last10Contracts": recordSet.recordset})
            lastTxsStatsStep3(landingArray)
        }).catch(function (err) {
            console.log(err);
            dbConn.close();
        });
    }).catch(function (err) {});
}

function lastTxsStatsStep3 (landingArray) {
    // Third step: Other types
    var sqlQuery = "SELECT Height, TxHash, TxType FROM BlockTransactions WHERE Height > 100000 AND (TxType = 'SfTx' OR TxType = 'host ann' OR TxType = 'blockreward') ORDER BY Height DESC OFFSET 10 ROWS FETCH NEXT 10 ROWS ONLY"
    var dbConn = new sql.ConnectionPool(sqlLogin);
    dbConn.connect().then(function () {
        var request = new sql.Request(dbConn);
        request.query(sqlQuery).then(function (recordSet) {
            dbConn.close();
            landingArray.push({"last10Others": recordSet.recordset})
            lastTxsStatsStep4(landingArray)
        }).catch(function (err) {
            console.log(err);
            dbConn.close();
        });
    }).catch(function (err) {});
}

function lastTxsStatsStep4 (landingArray) {
    // Fourth step: Analysys of the distribution of the last 10000 TX of the network
    var sqlQuery = "SELECT TxType FROM BlockTransactions WHERE Height > 100000 ORDER BY Height DESC OFFSET 10000 ROWS FETCH NEXT 10000 ROWS ONLY"
    var dbConn = new sql.ConnectionPool(sqlLogin);
    dbConn.connect().then(function () {
        var request = new sql.Request(dbConn);
        request.query(sqlQuery).then(function (recordSet) {
            dbConn.close();
            // Analyzing the result
            var scTx = 0
            var sfTx = 0
            var contracts = 0
            var revisions = 0
            var proofs = 0
            var resolutions = 0
            var allowance = 0
            var collateral = 0
            var hostann = 0
            var reward = 0
            var set = recordSet.recordset
            for (var n = 0; n < set.length; n++) {
                if (set[n].TxType == "ScTx") {scTx++}
                else if (set[n].TxType == "SfTx") {sfTx++}
                else if (set[n].TxType == "contract") {contracts++}
                else if (set[n].TxType == "allowancePost") {allowance++}
                else if (set[n].TxType == "blockreward") {reward++}
                else if (set[n].TxType == "collateralPost") {collateral++}
                else if (set[n].TxType == "contractresol") {resolutions++}
                else if (set[n].TxType == "host ann") {hostann++}
                else if (set[n].TxType == "revision") {revisions++}
                else if (set[n].TxType == "storageproof") {proofs++}
            }
            var distribution = {"sctx": scTx, "sftx": sfTx, "contracts": contracts, "allowance": allowance, "blockreward": reward,
                "collateral": collateral, "resolutions": resolutions, "hostannouncements": hostann, "revisions": revisions, "storageproofs": proofs}
            landingArray.push(distribution)

            // Saving the landingArray
            var stream = fs.createWriteStream("landingpagedata.json")
            var string = JSON.stringify(landingArray)
            stream.write(string)

        }).catch(function (err) {
            console.log(err);
            dbConn.close();
        });
    }).catch(function (err) {});
}


function itemizedIndexing(sqlBatch) {
    // This function indexes sequentially each query instead of the whole batch, as a backup plan if the batch fails
    var failCount = 0
    var successCount = 0
    itemizedSql(sqlBatch, failCount, successCount)
}

function itemizedSql(sqlBatch, failCount, successCount) {
    // We include jin the SQL database only the first element of the array, and repeat the function for each subsequent element
    var sqlQuery = sqlBatch[0]

    var dbConn = new sql.ConnectionPool(sqlLogin);
    dbConn.connect().then(function () {
        var request = new sql.Request(dbConn);
        request.query(sqlQuery).then(function (recordSet) {
            dbConn.close();
            successCount++

            // Remove one element and repeat
            sqlBatch.splice(0,1)
            if (sqlBatch.length > 0) {
                itemizedSql(sqlBatch, failCount, successCount)
            } else {
                // We are done
                console.log("////// Itemized indexing done. Total insertions: " + successCount + ", number of failed queries: " + failCount)
            }
            
        }).catch(function (err) {
            //console.log(err);
            //console.log("/// Query FAILED")
            failCount++
            dbConn.close();

            // Remove one element and repeat
            sqlBatch.splice(0,1)
            if (sqlBatch.length > 0) {
                itemizedSql(sqlBatch, failCount, successCount)
            } else {
                // We are done
                console.log("////// Itemized indexing done. Total insertions: " + successCount + ", number of failed queries: " + failCount)
            }
        });
    }).catch(function (err) {
        console.log(err);
    });
}
