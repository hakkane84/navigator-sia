// Indexes the Genesis block with its peculiarities
var exports = module.exports={}
var SqlComposer = require("./sql_composer.js")

exports.GenesisIndexing = async function(params, api) {
    var sqlBatch = []

    for (var i = 0; i < api.transactions.length; i++) {
        var masterHash = api.transactions[i].id

        // A - SiaFund airdrops
        if (api.transactions[i].siafundoutputs.length > 0) {
            
            // Tx info
            var toAddTxInfo = "('" + masterHash + "',''," + api.height+ "," + api.timestamp + ",0)"
            sqlBatch.push(SqlComposer.InsertSql(params, "TxInfo", toAddTxInfo, masterHash))

            // Tx as a hash type
            var toAddHashTypes = "('" + masterHash + "','SfTx','" + masterHash + "')"
            sqlBatch.push(SqlComposer.InsertSql(params, "HashTypes", toAddHashTypes, masterHash))

            var totalSFtransacted = 0
            for (var j = 0; j < api.transactions[i].siafundoutputs.length; j++) {
                var value = parseInt(api.transactions[i].siafundoutputs[j].value)
                totalSFtransacted = totalSFtransacted + value
                var address = api.transactions[i].siafundoutputs[j].unlockhash
                var outputId = api.transactions[i].siafundoutputs[j].id

                // AddressesChanges
                var toAddAddressChanges = "('" + address + "','" + masterHash + "',0," + value 
                    + ",0," + api.timestamp + ",'SfTx')"
                var checkString = address + "' and MasterHash='" + masterHash
                sqlBatch.push(SqlComposer.InsertSql(params, "AddressChanges", toAddAddressChanges, checkString))

                // AddressesBalance
                var sqlQuery = SqlComposer.CreateGenesisBalance(params, "Sf", address, value)
                sqlBatch.push(sqlQuery)

                // Output
                var sqlQuery = SqlComposer.CreateOutput(params, "Outputs-SF", outputId, value, address, api.height)
                sqlBatch.push(sqlQuery)

                // Address as hash type
                var toAddHashTypes = "('" + address + "','address','')"
                var sqlQuery = SqlComposer.InsertSql(params, "HashTypes", toAddHashTypes, address)
                sqlBatch.push(sqlQuery)

                // Output as hash type
                var toAddHashTypes = "('" + outputId + "','output','')"
                var sqlQuery = SqlComposer.InsertSql(params, "HashTypes", toAddHashTypes, outputId)
                sqlBatch.push(sqlQuery)
            }

            // Tx in a block (BlockTransactions)
            var toAddBlockTransactions = "(" + api.height + ",'" + masterHash + "','SfTx',0," + totalSFtransacted + ")"
            sqlBatch.push(SqlComposer.InsertSql(params, "BlockTransactions", toAddBlockTransactions, masterHash))
        }

        // B - Siacoin airdrops. There are not on the Sia blockchain, but this code exists for other forks
        if (api.transactions[i].siacoinoutputs.length > 0) {
            
            // Tx info
            var toAddTxInfo = "('" + masterHash + "',''," + api.height+ "," + api.timestamp + ",0)"
            sqlBatch.push(SqlComposer.InsertSql(params, "TxInfo", toAddTxInfo, masterHash))

            // Tx as a hash type
            var toAddHashTypes = "('" + masterHash + "','ScTx','" + masterHash + "')"
            sqlBatch.push(SqlComposer.InsertSql(params, "HashTypes", toAddHashTypes, masterHash))

            var totalSCtransacted = 0
            for (var j = 0; j < api.transactions[i].siacoinoutputs.length; j++) {
                var value = parseInt(api.transactions[i].siacoinoutputs[j].value)
                totalSCtransacted = totalSCtransacted + value
                var address = api.transactions[i].siacoinoutputs[j].unlockhash
                var outputId = api.transactions[i].siacoinoutputs[j].id

                // AddressesChanges
                var toAddAddressChanges = "('" + address + "','" + masterHash + "',0," + value 
                    + ",0," + api.timestamp + ",'ScTx')"
                var checkString = address + "' and MasterHash='" + masterHash
                sqlBatch.push(SqlComposer.InsertSql(params, "AddressChanges", toAddAddressChanges, checkString))

                // AddressesBalance
                var sqlQuery = SqlComposer.CreateGenesisBalance(params, "Sc", address, value)
                sqlBatch.push(sqlQuery)

                // Output
                var sqlQuery = SqlComposer.CreateOutput(params, "Outputs-SC", outputId, value, address, api.height)
                sqlBatch.push(sqlQuery)

                // Address as hash type
                var toAddHashTypes = "('" + address + "','address','')"
                var sqlQuery = SqlComposer.InsertSql(params, "HashTypes", toAddHashTypes, address)
                sqlBatch.push(sqlQuery)

                // Output as hash type
                var toAddHashTypes = "('" + outputId + "','output','')"
                var sqlQuery = SqlComposer.InsertSql(params, "HashTypes", toAddHashTypes, outputId)
                sqlBatch.push(sqlQuery)
            }

            // Tx in a block (BlockTransactions)
            var toAddBlockTransactions = "(" + api.height + ",'" + masterHash + "','ScTx',0," + totalSCtransacted + ")"
            sqlBatch.push(SqlComposer.InsertSql(params, "BlockTransactions", toAddBlockTransactions, masterHash))
        }
    }

    return sqlBatch
}