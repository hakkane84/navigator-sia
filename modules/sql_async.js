// SQL functions
var exports = module.exports={}
var Commons = require('./commons.js')
var SqlAsync = require('./sql_async.js')
var SqlComposer = require("./sql_composer.js")
var ExchangeRates = require('./exchangerates.js')

exports.Sql = async function(params, sqlQuery) 
{
    // Universal query to SQL database
    if (params.useMsSqlServer == true) { // Decides if using MS-SQL or SQLite
        // MS-SQL
        const pool = await params.msSqlPoolPromise
        try {
            const result = await pool.request().query(sqlQuery)
            return result.recordset
        } catch (e) {
            //console.log("\n" + sqlQuery)
            //console.log(e)
            return false
        }
    } else {
        // SQ-Lite
        // Detecting if it is a SELECT statement (uses a different function in the sqlite3 module)
        var s = sqlQuery.slice(0,6)
        if (s == "SELECT") { // Detecting if the statement is a SELECT one or not 
            // SELECT statements --> .all
            return new Promise(function(resolve) {
                params.sqLiteDb.all(sqlQuery, function(err, rows)  {
                    if (err) {
                        console.log("//// SQLite read error: " + err.message)
                        resolve([])
                    }
                    else {
                        resolve(rows)
                    }
                })
            })
        } else {
            // Rest of statements --> .run
            return new Promise(function(resolve) {
                params.sqLiteDb.run(sqlQuery, async function(err)  {
                    if (err) {
                        if ( err.message == "SQLITE_BUSY: database is locked") {
                            // In a very, very small number of cases, this error can be throwed by SQLite.
                            // We repeat the query after a 10 seconds timeout. We resolve the result of this recursive repeat
                            console.log("//// SQLite run error: `SQLITE_BUSY: database is locked`. Repeating query in 10sec")
                            await Commons.Delay(10000); // Async timeout
                            resolve(await SqlAsync.Sql(params, sqlQuery))
                        } else {
                            console.log("//// SQLite run error: " + err.message)
                            resolve(false)
                        }
                    }
                    else resolve(true)
                })
            }) 
        }

    }
}


// Sends a bacth of insert request, on failover, makes an itemized indexing
exports.BacthInsert = async function(params, sqlBatch, height, indexing) {
    if (indexing == true) {
        var word1 = "indexing"
        var word2 = "indexed"
    } else {
        var word1 = "deletion"
        var word2 = "deleted"
    }

    if (params.useMsSqlServer == true) {
        // Building a merged query. Only on MS SQL Server
        var mergedQuery = ""
        for (var i = 0; i < sqlBatch.length; i++) {
            mergedQuery = mergedQuery + sqlBatch[i]
            if (i < (sqlBatch.length - 1)) {
                mergedQuery = mergedQuery + " "
            }
        }

        // Try the batch-indexing
        var result = await SqlAsync.Sql(params, mergedQuery)

        // Failover: itemized indexing
        if (result == false) {
            console.log("// Batch " + word1 + " failed for block " + height + ". Proceding to itemized indexing")
            var failedItemizedQueries = 0
            for (var i = 0; i < sqlBatch.length; i++) {
                var result = await SqlAsync.Sql(params, sqlBatch[i])
                if (result == false) {
                    failedItemizedQueries++
                    console.log("// Failed itemized query for block " + height)
                }
            }

            if (failedItemizedQueries > 0) {
                console.log("Block " + height + " " + word2 + " - " + sqlBatch.length + " queries - " + failedItemizedQueries + " failed queries")
            } else {
                //console.log("Block " + height + " " + word2 + " - " + sqlBatch.length + " queries")
            }
        } else {
            // Batch indexing worked propeprly
            //console.log("Block " + height + " " + word2 + " - " + sqlBatch.length + " queries")
        }

    } else {
        // SQLite does not accept multiple queries on a single message round trip. We always do itemized indexing
        // Besides, according to https://sqlite.org/np1queryprob.html this is not an inefficiency issue for SQLite
        for (var i = 0; i < sqlBatch.length; i++) {
            var result = await SqlAsync.Sql(params, sqlBatch[i])
            if (result == false) {
                failedItemizedQueries++
                console.log("// Failed itemized query for block " + height + ":")
                console.log(sqlBatch[i])
            }
        }
        if (failedItemizedQueries > 0) {
            console.log("Block " + height + " " + word2 + " - " + sqlBatch.length + " queries - " + failedItemizedQueries + " failed queries")
        } else {
            //console.log("Block " + height + " " + word2 + " - " + sqlBatch.length + " queries")
        }
    }
    return
}


// Exchange rates database creation and population
exports.CheckExchangesDatabase = async function(params) 
{
    // Detects if an exchange rates databse exists. If not, creates one and populates it
    if (params.useMsSqlServer == true) { // Decides if using MS-SQL or SQLite
        // MS-SQL
        const pool = await params.msSqlPoolPromise
        var sqlQuery = "SELECT * FROM ExchangeRates"
        try {
            var result = await pool.request().query(sqlQuery)
            // No need to build if there is no error
        } catch (e) {
            console.log("* No Exchange rates table found. Creating a new one")
            var sqlQuery = await createExchangeTableMsSql(params)
            
            try {
                var result = await pool.request().query(sqlQuery)
                console.log("* Populating the table with data from CoinGecko. It will take ~5 minutes. Blockchain indexing will start shortly after that")
                await ExchangeRates.PopulateExchangeData(params, 0, 0)
            } catch (e) {
                console.log("// Error creating the ExchangeRates table")
                console.log(e)
            }
        }

    } else {
        // SQ-Lite
        var sqlQuery = "SELECT * FROM ExchangeRates"
        var sqlResult = await SqlAsync.Sql(params, sqlQuery)
        if (sqlResult.length == 0) {
            console.log("* No Exchange rates table found. Creating a new one")

            // This sql statement might not work in SQLite
            var sqlQuery = await createExchangeTableMsSql(params)
            
            // Adapting the syntax to particularities of SQLite
            if (params.useMsSqlServer == false) {
                sqlQuery = SqlComposer.SqLiteAdapter(sqlQuery)
            }

            var sqlResult = await SqlAsync.Sql(params, sqlQuery)
            if (sqlResult == false) {
                console.log("//// Error creating the ExchangeRates table")
                console.log(e)
            } else {
                console.log("* Populating the table with data from CoinGecko. It will take ~5 minutes. Blockchain indexing will start shortly after that")
                await ExchangeRates.PopulateExchangeData(params, 0, 0)
            }
        }
    }
}

async function createExchangeTableMsSql(params) {
    // Query for creating the table ExchangeRates with PK on Timestamp
    var sqlQuery = "CREATE TABLE ExchangeRates (\n"
            + "Timestamp bigint PRIMARY KEY"

    for (var i = 0; i < params.exchangeCurrencies.length; i++) {
        sqlQuery = sqlQuery + ", " + params.exchangeCurrencies[i] + " numeric(18, 12)"
    }

    sqlQuery = sqlQuery + ", SF numeric(20, 18));"
    return sqlQuery
}


// Checks the existance of the database tables, if not, creates new ones
exports.CheckNavigatorTables = async function(params) 
{
    if (params.useMsSqlServer == true) { // Detects if using MS-SQL or SQLite
        // MS-SQL
        const pool = await params.msSqlPoolPromise
        var sqlQuery = "SELECT Height FROM BlockInfo"
        try {
            var result = await pool.request().query(sqlQuery)
            // No need to build if there is no error
        } catch (e) {
            console.log("* Creating tables for the database...")
            await createNavigatorTables(params)
        }

    } else {
        // SQ-Lite
        var sqlQuery = "SELECT Height FROM BlockInfo"
        var sqlResult = await SqlAsync.Sql(params, sqlQuery)
        if (sqlResult.length == 0) {
            console.log("* Creating tables for the database...")
            await createNavigatorTables(params)   
        }
    }
}

async function createNavigatorTables(params) {
    // Creates the tables for the database
    var sqlQueries = []

    // BlockInfo
    sqlQueries[0] = "CREATE TABLE BlockInfo ("
        + "Height int PRIMARY KEY, "
        + "Timestamp bigint, "
        + "TransactionCount bigint, "
        + "Hash char(64), "
	    + "MinerPayoutAddress char(76), "
	    + "MinerArbitraryData varchar(max), "
	    + "Difficulty numeric(30, 0), "
	    + "Hashrate numeric(30, 0), "
	    + "TotalCoins numeric(36, 0), "
	    + "SiacoinInputCount bigint, "
	    + "SiacoinOutputCount bigint, "
	    + "FileContractRevisionCount bigint, "
	    + "StorageProofCount bigint, "
	    + "SiafundInputCount smallint, "
	    + "SiafundOutputCount smallint, "
	    + "ActiveContractCost numeric(36, 0), " 
	    + "ActiveContractCount int, "
	    + "ActiveContractSize numeric(24, 0), "
	    + "TotalContractCost numeric(36, 0), "
	    + "TotalContractCount bigint, "
	    + "TotalContractSize numeric(30, 0), "
	    + "NewContracts smallint, "
	    + "NewTx smallint, "
	    + "MiningPool varchar(15), "
        + "FeeCount bigInt, "
        + "FeeCountHastings numeric(36, 0)"
        + ")"

    // AddressesChanges
    sqlQueries[1] = "CREATE TABLE AddressChanges ("
        + "Address char(76), "
	    + "MasterHash char(64), "
	    + "ScChange numeric(36, 0), "
	    + "SfChange smallint, "
	    + "Height int, "
	    + "Timestamp bigint, "
	    + "TxType varchar(15)"
        + ")"
    sqlQueries[2] = "CREATE INDEX IX_AddressChanges ON AddressChanges (Address)"
    sqlQueries[3] = "CREATE INDEX IX_AddressChanges_1 ON AddressChanges (Height)"
    sqlQueries[4] = "CREATE INDEX IX_AddressChanges_2 ON AddressChanges (MasterHash)"

    // BlockTransactions
    sqlQueries[5] = "CREATE TABLE BlockTransactions ("
        + "Height int NULL, "
        + "TxHash char(64) PRIMARY KEY, "
        + "TxType varchar(15), "
        + "TotalAmountSc numeric(36, 0), "
        + "TotalAmountSf smallint"
        + ")"
    sqlQueries[6] = "CREATE INDEX IX_BlockTransactions ON BlockTransactions (Height)"

    // ContractInfo
    sqlQueries[7] = "CREATE TABLE ContractInfo ("
        + "MasterHash char(64) PRIMARY KEY, "
        + "ContractId char(64), "
        + "AllowancePosting char(76), "
        + "RenterValue numeric(36, 0), "
	+ "Allowance2Posting char(76), "
        + "Renter2Value numeric(36, 0), "
	+ "Allowance3Posting char(76), "
        + "Renter3Value numeric(36, 0), 
        + "CollateralPosting char(76), "
        + "HostValue numeric(36, 0), "
        + "Fees numeric(36, 0), "
        + "WindowStart int, "
        + "WindowEnd int, "
        + "RevisionNum int, "
        + "OriginalFileSize numeric(24, 0), "
        + "CurrentFileSize numeric(24, 0), "
        + "ValidProof1Output char(64), "
        + "ValidProof1Address char(76), "
        + "ValidProof1Value numeric(36, 0), "
        + "ValidProof2Output char(64), "
        + "ValidProof2Address char(76), "
        + "ValidProof2Value numeric(36, 0), "
        + "MissedProof1Output char(64), "
        + "MissedProof1Address char(76), "
        + "MissedProof1Value numeric(36, 0), "
        + "MissedProof2Output char(64), "
        + "MissedProof2Address char(76), "
        + "MissedProof2Value numeric(36, 0), "
        + "MissedProof3Output char(64), "
        + "MissedProof3Address char(76), "
        + "MissedProof3Value numeric(36, 0), "
        + "Height int, "
        + "Timestamp bigint, "
        + "Status varchar(15), "
        + "Renew bit, "
        + "AtomicRenewal bit, "
        + "RenewsContractId char(64)"
        + ")"
    sqlQueries[8] = "CREATE INDEX IX_ContractInfo ON ContractInfo (Height)"
    sqlQueries[9] = "CREATE INDEX IX_ContractInfo_1 ON ContractInfo (ContractId)"
    sqlQueries[10] = "CREATE INDEX IX_ContractInfo_2 ON ContractInfo (WindowEnd)"
    sqlQueries[11] = "CREATE INDEX IX_ContractInfo_3 ON ContractInfo (RenewsContractId)"
    
    // ContractResolutions
    sqlQueries[12] = "CREATE TABLE ContractResolutions ("
        + "MasterHash char(64) PRIMARY KEY, "
        + "ContractId char(64), "
        + "Fees numeric(36, 0), "
        + "Result varchar(15), "
        + "Height int, "
        + "Timestamp bigint, "
        + "Output0Address char(76), "
        + "Output0Value numeric(36, 0), "
        + "Output1Address char(76), "
        + "Output1Value numeric(36, 0), "
        + "Output2Address char(76), "
        + "Output2Value numeric(36, 0)"
        + ")"
    sqlQueries[13] = "CREATE INDEX IX_ContractResolutions ON ContractResolutions (Height)"
    sqlQueries[14] = "CREATE INDEX IX_ContractResolutions_1 ON ContractResolutions (ContractId)"

    // HashTypes
    sqlQueries[15] = "CREATE TABLE HashTypes ("
        + "Hash varchar(76) PRIMARY KEY, "
        + "Type varchar(15), "
        + "Masterhash char(76)"
        + ")"

    // HostAnnInfo
    sqlQueries[16] = "CREATE TABLE HostAnnInfo ("
        + "TxHash char(64) PRIMARY KEY, "
        + "HashSynonyms varchar(max), "
        + "Height int, "
        + "Timestamp bigint, "
        + "Fees numeric(36, 0), "
        + "IP varchar(max)"
        + ")"
    sqlQueries[17] = "CREATE INDEX IX_HostAnnInfo ON HostAnnInfo (Height)"

    // RevisionsInfo
    sqlQueries[18] = "CREATE TABLE RevisionsInfo ("
        + "MasterHash char(64) PRIMARY KEY, "
        + "ContractId char(64), "
        + "Fees numeric(36, 0), "
        + "NewRevisionNum int, "
        + "NewFileSize numeric(24, 0), "
        + "ValidProof1Address char(76), "
        + "ValidProof1Value numeric(36, 0), "
        + "ValidProof2Address char(76), "
        + "ValidProof2Value numeric(36, 0), "
        + "MissedProof1Address char(76), "
        + "MissedProof1Value numeric(36, 0), "
        + "MissedProof2Address char(76), "
        + "MissedProof2Value numeric(36, 0), "
        + "MissedProof3Address char(76), "
        + "MissedProof3Value numeric(36, 0), "
        + "Height int, "
        + "Timestamp bigint, "
        + "HashSynonyms varchar(max)"
        + ")"
    sqlQueries[19] = "CREATE INDEX IX_RevisionsInfo ON RevisionsInfo (Height)"
    sqlQueries[20] = "CREATE INDEX IX_RevisionsInfo_1 ON RevisionsInfo (ContractId)"

    // TxInfo
    sqlQueries[21] = "CREATE TABLE TxInfo ("
        + "TxHash char(64) PRIMARY KEY, "
        + "HashSynonyms varchar(max), "
        + "Height int, "
        + "Timestamp bigint, "
        + "Fees numeric(36, 0)"
        + ")"
    sqlQueries[22] = "CREATE INDEX IX_TxInfo ON TxInfo (Height)"

    // Outputs
    sqlQueries[23] = "CREATE TABLE Outputs ("
        + "OutputId char(64) PRIMARY KEY, "
        + "ScValue numeric(36, 0), "
        + "SfValue smallint, "
        + "Address char(76), "
        + "CreatedOnBlock int, "
        + "Spent bit, "
        + "SpentOnBlock int ,"
        + "FoundationUnclaimed bit"
        + ")"
    sqlQueries[24] = "CREATE INDEX IX_Outputs ON Outputs (Address)"
    sqlQueries[25] = "CREATE INDEX IX_Outputs_1 ON Outputs (CreatedOnBlock)"
    sqlQueries[26] = "CREATE INDEX IX_Outputs_2 ON Outputs (SpentOnBlock)"

    // AddressesBalance
    sqlQueries[27] = "CREATE TABLE AddressesBalance ("
        + "Address char(76) PRIMARY KEY, "
        + "BalanceSc numeric(36, 0), "
        + "BalanceSf smallint"
        + ")"
    sqlQueries[28] = "CREATE INDEX IX_AddressesBalance ON AddressesBalance (BalanceSc)"
    sqlQueries[29] = "CREATE INDEX IX_AddressesBalance_1 ON AddressesBalance (BalanceSf)"
    
    // Reorgs
    sqlQueries[30] = "CREATE TABLE Reorgs ("
        + "Hash char(64), "
        + "MiningPool varchar(15), "
        + "MiningAddress char(76), "
        + "Height int, "
        + "ReorgEventNum int, "
        + "DetectionTimestamp bigint, "
        + "ReplacingHash char(64), "
        + "ReplacingMiningPool varchar(15), "
        + "ReplacingMiningAddress char(76)"
        + ")"
    sqlQueries[31] = "CREATE INDEX IX_Reorgs ON Reorgs (ReorgEventNum)"

    // UnconfirmedBalances
    sqlQueries[32] = "CREATE TABLE UnconfirmedBalances ("
        + "Address char(76), "
        + "TxHash char(64), "
        + "Timestamp bigint, "
        + "ScValue numeric(36, 0), "
        + "SfValue smallint, "
        + "TxType varchar(15)"
        + ")"
    sqlQueries[33] = "CREATE INDEX IX_UnconfirmedBalances ON UnconfirmedBalances (Address)"
    sqlQueries[34] = "CREATE INDEX IX_UnconfirmedBalances_1 ON UnconfirmedBalances (TxHash)"

    // StorageProofsInfo
    sqlQueries[35] = "CREATE TABLE StorageProofsInfo ("
        + "MasterHash char(64) PRIMARY KEY, "
        + "ContractId char(64), "
        + "HashSynonyms varchar(max), "
        + "Height int, "
        + "Timestamp bigint, "
        + "Fees numeric(36, 0)"
        + ")"
    sqlQueries[36] = "CREATE INDEX IX_StorageProofsInfo ON StorageProofsInfo (Height)"
    sqlQueries[37] = "CREATE INDEX IX_StorageProofsInfo_1 ON StorageProofsInfo (ContractId)"

    // Table for the changes on the main and failover Sia Foundation addresses where the subisdies are deposited
    sqlQueries[38] =  "CREATE TABLE FoundationAddressesChanges ("
        + "Height int PRIMARY KEY, "
        + "FoundationAddress char(76), "
        + "FailoverAddress char(76)"
        + ")"

    // Populating the initial entry on FoundationAddressesChanges with values from the Sia API
    var api = await Commons.MegaRouter(params, 0, '/consensus')
    var foundationAddress = api.foundationprimaryunlockhash
    var failoverAddress = api.foundationfailsafeunlockhash
    sqlQueries[39] = "INSERT INTO FoundationAddressesChanges (Height,FoundationAddress,FailoverAddress) VALUES "
        + "(0,'" + foundationAddress + "','" + failoverAddress + "')"

    // Loop for creating the tables
    for (var i = 0; i < sqlQueries.length; i++) {
        if (sqlQueries[i] != null) {
            // Adapting the syntax to particularities of SQLite
            if (params.useMsSqlServer == false) {
                sqlQueries[i] = SqlComposer.SqLiteAdapter(sqlQueries[i])
            }

            var sqlResult = await SqlAsync.Sql(params, sqlQueries[i])
        }
    }
    console.log("* Main databases created!")

    return
}

