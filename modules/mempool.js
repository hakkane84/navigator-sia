// Indexes the transactions on the mempool (unconfirmed transactions)
var exports = module.exports={}
var fs = require('fs')
var Commons = require('./commons.js')
var ParentFinder = require("./parentfinder.js")
var SqlAsync = require('./sql_async.js')

exports.Index = async function(params) {
    // Collects the mempool and saves it in the SQL database
    var mempoolSize = 0
    sqlBatch = []
    timestamp = Math.floor(Date.now() / 1000)

    // A - Getting the mempool from Sia
    try {
        var apiTpool = await Commons.MegaRouter(params, 0, '/tpool/transactions')
        mempoolSize = apiTpool.transactions.length
    } catch (e) {
        var apiTpool = {transactions: []} // Empty object
    }
    
    // B - Expanding the API finding outputs and the sender addresses
    if (mempoolSize > 0) {
        var api = await ParentFinder.ParentFinder(params, apiTpool)
        api = api.transactions
    } else  {
        var api = []
    }

    // C - Getting currently stored mempool
    var sqlQuery = "SELECT DISTINCT TxHash FROM UnconfirmedBalances"
    var sqlMempool = await SqlAsync.Sql(params, sqlQuery)

    // D - Processing
    for (i = 0; i < api.length; i++) {
        try {
            // D0 - Calculating a hash for each transaction. As calculating the blake2b hash is complex and I just need an unique
            // identifier, I calculate instead a base64-encoded string containing the transactionsignatures serialized
            // Characters from 20 to 84
            var s = serialize(apiTpool.transactions[i].transactionsignatures)
            var b = new Buffer.from(s);
            var h = b.toString('base64');
            var hash = h.slice(20, 84)
            
            // D1 - Comparing new mempool with old
            var match = false
            for (var j = 0; j < sqlMempool.length; j++) {
                if (hash == sqlMempool[j].TxHash) {
                    match = true
                    // We flag this TX from mempool to keep it
                    sqlMempool[j].keep = true
                }
            }
            
            // If no match, add address change to database
            if (match == false) {
                // D2 - Determining TX Type
                var type = ""
                if (api[i].siacoininputs.length != 0 && api[i].filecontracts.length == 0 && api[i].filecontractrevisions.length == 0 
                    && api[i].storageproofs.length == 0 && api[i].siafundinputs.length == 0 && api[i].siafundoutputs.length == 0) 
                {
                    // Determining if it is a host announcement
                    var arbitraryData = api[i].rawtransaction.arbitrarydata
                    if (arbitraryData.length > 0) {
                        slice = arbitraryData[0].slice(0,14)
                        if (slice == "SG9zdEFubm91bm") {
                            type = "host ann"
                        } else {
                            type = "ScTx"
                        }
                    }
                    type = "ScTx"
                } else if (api[i].siafundinputs.length != 0) {
                    type = "SfTx"
                } else if (api[i].filecontracts.length != 0) {
                    type = "contract"
                } else if (api[i].filecontractrevisions.length != 0) {
                    type = "revision"
                } else if (api[i].storageproofs.length != 0) {
                    type = "storageproof"
                }
                
                // D3 - Receiving addresses: SC
                for (var j = 0; j < api[i].siacoinoutputs.length; j++) {
                    var sqlQuery = "INSERT INTO UnconfirmedBalances (Address, TxHash, Timestamp, ScValue, SfValue, TxType) VALUES "
                        + "('" + api[i].siacoinoutputs[j].unlockhash + "','" + hash + "'," + timestamp + "," 
                        + BigInt(api[i].siacoinoutputs[j].value) + ",0,'" + type + "')"
                    sqlBatch.push(sqlQuery)
                }

                // D4 - Receiving addresses: SF
                for (var j = 0; j < api[i].siafundoutputs.length; j++) {
                    var sqlQuery = "INSERT INTO UnconfirmedBalances (Address, TxHash, Timestamp, ScValue, SfValue, TxType) VALUES "
                        + "('" + api[i].siafundoutputs[j].unlockhash + "','" + hash + "'," + timestamp + ",0," 
                        + parseInt(api[i].siafundoutputs[j].value) + ",'" + type + "')"
                    sqlBatch.push(sqlQuery)
                }

                // D5 - Sending addresses: SC
                for (var j = 0; j < api[i].siacoininputoutputs.length; j++) {
                    if (api[i].siacoininputoutputs[j].unlockhash != "unknown address") {
                        var sqlQuery = "INSERT INTO UnconfirmedBalances (Address, TxHash, Timestamp, ScValue, SfValue, TxType) VALUES "
                            + "('" + api[i].siacoininputoutputs[j].unlockhash + "','" + hash + "'," + timestamp + "," 
                            + BigInt(api[i].siacoininputoutputs[j].value * -1) + ",0,'" + type + "')"
                        sqlBatch.push(sqlQuery)
                    }
                }

                // D6 - Sending addresses: SF
                for (var j = 0; j < api[i].siafundinputoutputs.length; j++) {
                    if (api[i].siafundinputoutputs[j].unlockhash != "unknown address") {
                        var sqlQuery = "INSERT INTO UnconfirmedBalances (Address, TxHash, Timestamp, ScValue, SfValue, TxType) VALUES "
                            + "('" + api[i].siafundinputoutputs[j].unlockhash + "','" + hash + "'," + timestamp + "," 
                            + BigInt(api[i].siafundinputoutputs[j].value * -1) + ",0,'" + type + "')"
                        sqlBatch.push(sqlQuery)
                    }
                }
            }

        } catch (e) {
            console.log("//// Error parsing the mempool: ")
            console.log(e)
        }
    }

    // E - Checking those not anymore on the mempool, and delete them
    for (var i = 0; i < sqlMempool.length; i++) {
        if (sqlMempool[i].keep != true) {
            var sqlQuery = "DELETE FROM UnconfirmedBalances WHERE TxHash='" + sqlMempool[i].TxHash + "'"
            sqlBatch.push(sqlQuery)
        } else {
            // Do nothing, it is a TX still in the mempool and already indexed
        }
    }

    // F - Saving in the SQL database
    await SqlAsync.BacthInsert(params, sqlBatch, null, false)

    return mempoolSize
}


// Serializes recursively an object and transforms it into a string
serialize = function(obj, prefix) {
    var str = [],
    p;
    for (p in obj) {
        if (obj.hasOwnProperty(p)) {
            var k = prefix ? prefix + "[" + p + "]" : p,
            v = obj[p];
            str.push((v !== null && typeof v === "object") ?
            serialize(v, k) :
            encodeURIComponent(k) + "=" + encodeURIComponent(v));
        }
    }
    return str.join("&");
}