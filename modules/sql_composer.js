// Composes the SQL statements in SQL language
var exports = module.exports={}
var SqlComposer = require("./sql_composer.js")

exports.MultiSelect = async function(columns, table, whereCondition, whereArray, stringBoolean) {
    // Takes an array of WHERE conditions to build a multi-SELECT statement
    var sqlQuery = ""
    if (whereArray.length > 0) { // Sanity check
        var sqlQuery = "SELECT " + columns + " FROM " + table + " WHERE "
        for (var i = 0; i < whereArray.length; i++) {
            sqlQuery = sqlQuery + whereCondition + "="
            if (stringBoolean == true) {sqlQuery = sqlQuery + "'"}
            sqlQuery = sqlQuery + whereArray[i]
            if (stringBoolean == true) {sqlQuery = sqlQuery + "'"}
            if (i < (whereArray.length - 1)) {
                sqlQuery = sqlQuery + " OR "
            }
        }
    }
    
    return sqlQuery
}


exports.InsertSql= function(params, table, toAdd, toCheck) {
    // Constructing the SQL query, depending on the table to update. It returns the SQL sentenceto be included on the batch
    
    if (table == "BlockInfo") {
        var sqlQuery = "IF NOT EXISTS (SELECT Height FROM BlockInfo WHERE Height = " + toCheck
            + ") INSERT INTO BlockInfo (Height,Timestamp,TransactionCount,Hash,MinerPayoutAddress,MinerArbitraryData,Difficulty,Hashrate,"
            + "TotalCoins,SiacoinInputCount,SiacoinOutputCount,FileContractRevisionCount,StorageProofCount,SiafundInputCount,SiafundOutputCount,"
            + "ActiveContractCost,ActiveContractCount,ActiveContractSize,TotalContractCost,TotalContractCount,TotalContractSize,NewContracts," 
            + "NewTx,MiningPool,FeeCount,FeeCountHastings"
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
            + "') INSERT INTO ContractInfo (MasterHash,ContractId,AllowancePosting,RenterValue,Allowance2Posting,Renter2Value,"
            + "CollateralPosting,HostValue,Fees,WindowStart,WindowEnd," 
            + "RevisionNum,OriginalFileSize,CurrentFileSize,ValidProof1Output,ValidProof1Address,ValidProof1Value,ValidProof2Output,ValidProof2Address,ValidProof2Value," 
            + "MissedProof1Output,MissedProof1Address,MissedProof1Value,MissedProof2Output,MissedProof2Address,MissedProof2Value,"
            + "MissedProof3Output,MissedProof3Address,MissedProof3Value,Height,Timestamp,Status,Renew,AtomicRenewal,RenewsContractId)"  
            + " VALUES " + toAdd

    } else if (table == "RevisionsInfo") {
        var sqlQuery = "IF NOT EXISTS (SELECT MasterHash FROM RevisionsInfo WHERE MasterHash = '" + toCheck
            + "') INSERT INTO RevisionsInfo (MasterHash,ContractId,Fees," 
            + "NewRevisionNum,NewFileSize,ValidProof1Address,ValidProof1Value,ValidProof2Address,ValidProof2Value," 
            + "MissedProof1Address,MissedProof1Value,MissedProof2Address,MissedProof2Value,"
            + "MissedProof3Address,MissedProof3Value,Height,Timestamp,HashSynonyms)"
            + " VALUES " + toAdd

    } else if (table == "StorageProofsInfo") {
        var sqlQuery = "IF NOT EXISTS (SELECT MasterHash FROM StorageProofsInfo WHERE MasterHash = '" + toCheck
            + "') INSERT INTO StorageProofsInfo (MasterHash,ContractId,HashSynonyms,Height,Timestamp,Fees) VALUES " + toAdd

    } else if (table == "ContractResolutions") {
        var sqlQuery = "IF NOT EXISTS (SELECT MasterHash FROM ContractResolutions WHERE MasterHash = '" + toCheck
            + "') INSERT INTO ContractResolutions (MasterHash,ContractId,Fees,Result,Height,Timestamp," 
            + "Output0Address,Output0Value,Output1Address,Output1Value,Output2Address,Output2Value)"
            + " VALUES " + toAdd 

    } else if (table == "ReviseContract") { // This is not a table, but instead a call to update a current contract
        var sqlQuery = "UPDATE ContractInfo SET " + toAdd + " WHERE ContractId = '" + toCheck + "'"
    
    } else if (table == "UnconfirmedTxs") {
        // Inserts unconfirmed txs. Not necessary to use "if not exists", as it is always an empty table
        var sqlQuery = "INSERT INTO UnconfirmedTxs (TxHash,Timestamp,ScValue,SfValue,TxType) VALUES " + toAdd

    } else if (table == "UnconfirmedBalances") {
        // Inserts unconfirmed addresses changes. Not necessary to use "if not exists", as it is always an empty table
        var sqlQuery = "INSERT INTO UnconfirmedBalances (Address,TxHash,Timestamp,ScValue,SfValue,TxType) VALUES " + toAdd
    
    } else if (table == "AddressesBalance") {
        var sqlQuery = "IF NOT EXISTS (SELECT Address FROM AddressesBalance WHERE Address = '" + toCheck
            + "') INSERT INTO AddressesBalance (Address, BalanceSc, BalanceSf) VALUES " + toAdd
    } 


    // Adapting the syntax to particularities of SQLite
    if (params.useMsSqlServer == false) {
        sqlQuery = SqlComposer.SqLiteAdapter(sqlQuery)
    }

    return sqlQuery
}


exports.CreateGenesisBalance = function(params, coin, address, value) {
    // Genesis balances
    if (coin == "Sc") { // Siacoins
        var sqlQuery = "IF NOT EXISTS (SELECT Address FROM AddressesBalance WHERE Address = '" + address
        + "') INSERT INTO AddressesBalance (Address, BalanceSc, BalanceSf) VALUES ('"
            + address + "'," + value + ",0)"
    } else { // Siafunds
        var sqlQuery = "IF NOT EXISTS (SELECT Address FROM AddressesBalance WHERE Address = '" + address
        + "') INSERT INTO AddressesBalance (Address, BalanceSc, BalanceSf) VALUES ('"
        + address + "',0," + value + ")"
    }
    if (params.useMsSqlServer == false) {
        // Adapting the syntax to particularities of SQLite
        sqlQuery = SqlComposer.SqLiteAdapter(sqlQuery)
    }
    return sqlQuery
}

exports.CreateOutput = function(params, table, outputId, value, address, block) {
    if (table == "Outputs-SC") {
        var sqlQuery = "IF (NOT EXISTS(SELECT * FROM Outputs WHERE OutputId='" + outputId + "'))"
        + " BEGIN INSERT INTO Outputs (OutputId,ScValue,Address,CreatedOnBlock) VALUES ('" + outputId + "'," + value + ",'" + address + "'," + block + ")"
        + " END ELSE BEGIN"
        + " UPDATE Outputs SET ScValue = " + value + ", Address = '" + address  + "', CreatedOnBlock = " + block + " WHERE OutputId ='" + outputId + "' END"
    
    } else if (table == "Outputs-SC-FoundationUnlciamed") {
        var sqlQuery = "IF (NOT EXISTS(SELECT * FROM Outputs WHERE OutputId='" + outputId + "'))"
        + " BEGIN INSERT INTO Outputs (OutputId,ScValue,Address,CreatedOnBlock,FoundationUnclaimed) VALUES ('" + outputId + "'," + value + ",'" + address + "'," + block + ",1)"
        + " END ELSE BEGIN"
        + " UPDATE Outputs SET ScValue = " + value + ", Address = '" + address  + "', CreatedOnBlock = " + block + ", FoundationUnclaimed = 1 " + " WHERE OutputId ='" + outputId + "' END"
    
    } else if (table == "Outputs-SF") {
        var sqlQuery = "IF (NOT EXISTS(SELECT * FROM Outputs WHERE OutputId='" + outputId + "'))"
        + " BEGIN INSERT INTO Outputs (OutputId,SfValue,Address,CreatedOnBlock) VALUES ('" + outputId + "'," + value + ",'" + address + "'," + block + ")"
        + " END ELSE BEGIN"
        + " UPDATE Outputs SET SfValue = " + value + ", Address = '" + address  + "', CreatedOnBlock = " + block + " WHERE OutputId ='" + outputId + "' END"
    }

    // Adapting the syntax to particularities of SQLite.
    if (params.useMsSqlServer == false) {
        sqlQuery = SqlComposer.SqLiteAdapter(sqlQuery)
    }

    return sqlQuery
}

exports.UpdateOutput = function(params, outputId, block) {
    // Creates an SQL sentence for updating an output as spent. If no entry is found, it creates a new one already spent
    
    // var sqlQuery = "UPDATE Outputs SET Spent = 1, SpentOnBlock = " + block
    //     + " WHERE OutputId ='" + outputId + "'"
    //     + " IF @@ROWCOUNT=0 INSERT INTO Outputs (OutputId,Spent,SpentOnBlock)"
    //     + " VALUES ('" + outputId + "',1," + block + ")"

    var sqlQuery = "IF (NOT EXISTS(SELECT * FROM Outputs WHERE OutputId='" + outputId + "'))"
        + " BEGIN INSERT INTO Outputs (OutputId,Spent,SpentOnBlock) VALUES ('" + outputId + "',1," + block + ")"
        + " END ELSE BEGIN"
        + " UPDATE Outputs SET Spent = 1, SpentOnBlock = " + block + " WHERE OutputId ='" + outputId + "' END"

    // Adapting the syntax to particularities of SQLite.
    if (params.useMsSqlServer == false) {
        sqlQuery = SqlComposer.SqLiteAdapter(sqlQuery)
    }

    return sqlQuery
    //console.log("// Spending output not found on the database")
}

exports.InsertAlreadySpentOutput = function(params, outputId, block, value, address, coin) {
    // Creates an SQL sentence for adding an output that is being spent in this same block
    if (coin == "sc") {
        // Siacoins
        var sqlQuery = "IF NOT EXISTS (SELECT OutputId FROM Outputs WHERE OutputId = '" + outputId
            + "') INSERT INTO Outputs (OutputId,ScValue,Address,CreatedOnBlock,Spent,SpentOnBlock)"
            + " VALUES ('" + outputId + "'," + value + ",'" + address + "'," + block + ",1," + block + ")"
    } else if (coin == "sf") {
        // SiaFunds
        var sqlQuery = "IF NOT EXISTS (SELECT OutputId FROM Outputs WHERE OutputId = '" + outputId
            + "') INSERT INTO Outputs (OutputId,SfValue,Address,CreatedOnBlock,Spent,SpentOnBlock)"
            + " VALUES ('" + outputId + "'," + value + ",'" + address + "'," + block + ",1," + block + ")"
    }
    
    // Adapting the syntax to particularities of SQLite
    if (params.useMsSqlServer == false) {
        sqlQuery = SqlComposer.SqLiteAdapter(sqlQuery)
    }

    return sqlQuery
}


exports.SqLiteAdapter = function (sqlQuery) {
    // Adapts an SQL query to SQLite syntax
    
    // varchar(max) --> varchar(1000)
    sqlQuery = sqlQuery.replace(/max/g, "1000")

    // CREATE TABLE --> CREATE TABLE IF NOT EXISTS
    sqlQuery = sqlQuery.replace(/CREATE TABLE/g, "CREATE TABLE IF NOT EXISTS")

    // IF NOT EXISTS ELSE UPDATE --> UPSERT syntax
    if (sqlQuery.slice(0,21) == "IF (NOT EXISTS(SELECT") {
        var b = sqlQuery.search("BEGIN");
        var e = sqlQuery.search("END");
        var adaptedQuery = sqlQuery.slice(b + 6, e - 1) + " ON CONFLICT("
        var w = sqlQuery.search("WHERE");
        var eq = sqlQuery.search("=");
        adaptedQuery = adaptedQuery + sqlQuery.slice(w + 6, eq) + ") DO UPDATE "
        
        var slice = sqlQuery.slice(e)
        var s = slice.search("SET");
        var w2 = slice.search("WHERE");
        adaptedQuery = adaptedQuery + slice.slice(s, w2 - 1)
        sqlQuery = adaptedQuery
    }

    // IF NOT EXISTS ELSE INSERT --> INSERT OR IGNORE
    if (sqlQuery.slice(0,21) == "IF NOT EXISTS (SELECT") {
        var into = sqlQuery.search("INTO");
        sqlQuery = "INSERT OR IGNORE " + sqlQuery.slice(into)
    }

    return sqlQuery
}


exports.SelectTop = function(params, table, columns, columnOrder, maxEntries) {
    // Creates an SQL SELECT sentence taking only the top "maxEntries" entries, according to "columnOrder"
    if (params.useMsSqlServer == true) {
        // MS SQL Server syntax
        sqlQuery = "SELECT TOP " + maxEntries + " " + columns + " FROM " + table + " ORDER BY " + columnOrder + " DESC"
    } else {
        // SQLite syntax
        sqlQuery = "SELECT " + columns + " FROM " + table + " ORDER BY " + columnOrder + " DESC LIMIT " + maxEntries
    }

    return sqlQuery
}

exports.SelectTopWhere = function(params, table, columns, columnOrder, maxEntries, whereConditions) {
    // Creates an SQL SELECT sentence taking only the top "maxEntries" entries, according to "columnOrder" and using WHERE
    // conditions
    if (params.useMsSqlServer == true) {
        // MS SQL Server syntax
        sqlQuery = "SELECT TOP " + maxEntries + " " + columns + " FROM " + table + " WHERE " + whereConditions + " ORDER BY " + columnOrder + " DESC"
    } else {
        // SQLite syntax
        sqlQuery = "SELECT " + columns + " FROM " + table + " WHERE " + whereConditions + " ORDER BY " + columnOrder + " DESC LIMIT " + maxEntries
    }

    return sqlQuery
}


exports.InsertReorg = function(params, block, reorgEventNum) {
    // Creates an SQL INSERT sentence for a blockchain reorganization event
    var timestamp = Math.floor(Date.now() / 1000)
    var sqlQuery = "INSERT INTO Reorgs (Hash,MiningPool,MiningAddress,Height,ReorgEventNum,DetectionTimestamp,ReplacingHash,ReplacingMiningPool,ReplacingMiningAddress)"
        + " VALUES ('" + block.hash + "','" + block.miningPool + "','" + block.miningAddress + "'," + block.height + "," + reorgEventNum 
        + "," + timestamp + ",'" + block.replacingHash + "','" + block.replacingPool + "','" + block.replacingMiningAddress + "')"

    return sqlQuery
}
