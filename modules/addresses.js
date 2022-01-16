// Saves the changes in addresses balance in AddressesChanges and updates the final balance in AddressesBalance tables
var exports = module.exports={}
var SqlComposer = require("./sql_composer.js")
var Addresses = require("./addresses.js")
var SqlAsync = require('./sql_async.js')

exports.Addresses = async function(params, sqlBatch, addressesImplicated, height, timestamp) {
    // Prepares Addresses changes and address as a hash type for inclusion in the database
    
    // De-duplication of MasterHash + Address combinations. ScTx transactions already do this, but not the code for contracts 
    const sortByTwo = (arr = []) => {
        arr.sort((a, b) => {
           return a.masterHash.localeCompare(b.masterHash) || a.hash.localeCompare(b.hash);
        });
    };
    sortByTwo(addressesImplicated);
    for (var m = 1; m < addressesImplicated.length; m++) {
        if (addressesImplicated[m].masterHash == addressesImplicated[m-1].masterHash
        && addressesImplicated[m].hash == addressesImplicated[m-1].hash) {
            addressesImplicated[m-1].sc = BigInt(addressesImplicated[m-1].sc) + BigInt(addressesImplicated[m].sc)
            addressesImplicated[m-1].sf = BigInt(addressesImplicated[m-1].sf) + BigInt(addressesImplicated[m].sf)
            addressesImplicated.splice(m, 1)
            if (m >= addressesImplicated.length) { break } // For safety, as length might have changed
            m--  
        }
    }
    
    for (var m = 0; m < addressesImplicated.length; m++) {
        if (addressesImplicated[m].masterHash == null) {
            // Pass
        } else {
            // Avoid "unknown addresses", as they are result of accidental missing info on the database
            if (addressesImplicated[m].hash != "unknown address") {
                if (addressesImplicated[m].txType != null) {
                    // Non-SC, non-SF transactions
                    var toAddAddressChanges = "('" + addressesImplicated[m].hash + "','" + addressesImplicated[m].masterHash + "'," 
                        + BigInt(addressesImplicated[m].sc) + "," + addressesImplicated[m].sf + "," + height + "," + timestamp + ",'" 
                        + addressesImplicated[m].txType + "')"
                } else if (addressesImplicated[m].sc > 0 || addressesImplicated[m].sc < 0) {
                    // Siacoin TXs
                    var toAddAddressChanges = "('" + addressesImplicated[m].hash + "','" + addressesImplicated[m].masterHash + "'," 
                        + BigInt(addressesImplicated[m].sc) + "," + addressesImplicated[m].sf + "," + height + "," + timestamp + ",'ScTx')"
                } else {
                    // SiaFund TX
                    var toAddAddressChanges = "('" + addressesImplicated[m].hash + "','" + addressesImplicated[m].masterHash + "'," 
                        + BigInt(addressesImplicated[m].sc) + "," + addressesImplicated[m].sf + "," + height + "," + timestamp + ",'SfTx')"
                }

                var checkString = addressesImplicated[m].hash + "' and MasterHash='" + addressesImplicated[m].masterHash 

                // This check will look rows with the fields Address and MasterHash to not include a duplicate
                sqlBatch.push(SqlComposer.InsertSql(params, "AddressChanges", toAddAddressChanges, checkString))

                // Addresses as hash types
                var toAddHashTypes = "('" + addressesImplicated[m].hash + "','address','')"
                sqlBatch.push(SqlComposer.InsertSql(params, "HashTypes", toAddHashTypes, addressesImplicated[m].hash))
            }
        }
    }

    // Addresses balance update
    // Temporally disabled, as the table of balances is currently bugged and is causing unnecesary overhead
    //sqlBatch = await Addresses.Balances(params, sqlBatch, addressesImplicated, false)
    
    return sqlBatch
}


exports.Balances = async function(params, sqlBatch, addressesImplicated, deleting) {
    // Addresses balance update. The deleting flag reverses the amounts, so we can reuse this function to delete a block by removing 
    // amounts from balances

    // A - Consolidating multiple changes to the same address in the the list
    var addressesNew = []
    for (var i = 0; i < addressesImplicated.length; i++) {
        if (addressesImplicated[i].hash != "unknown address") {
            // Parsing amounts
            addressesImplicated[i].sc = BigInt(addressesImplicated[i].sc)
            addressesImplicated[i].sf = parseInt(addressesImplicated[i].sf)
            var match = false
            for (var j = 0; j < addressesNew.length; j++) {
                if (addressesImplicated[i].hash == addressesNew[j].hash) {
                    if (addressesImplicated[i].sc > 0 || addressesImplicated[i].sc < 0) {
                        addressesNew[j].sc = addressesNew[j].sc + addressesImplicated[i].sc
                    } else if (addressesImplicated[i].sf > 0 || addressesImplicated[i].sf < 0) {
                        addressesNew[j].sf = addressesNew[j].sf + addressesImplicated[i].sf
                    }
                    match = true
                }
            }
            if (match == false) {
                // Add to the new array. Only if there was an actual change. Changes = 0 are a result of missing outputs on the database
                if (addressesImplicated[i].sc > 0 || addressesImplicated[i].sc < 0 || addressesImplicated[i].sf > 0 || addressesImplicated[i].sf < 0) {
                    addressesNew.push(addressesImplicated[i])
                }
            }
        }    
    }

    // B - Collecting the balance of the old addresses in a batch SELECT request. Done in "sqlArgumentsSize"-sized queries by the sql_composer module
    currentBalances = []
    addressesScanned = 0 // A counter of how many addresses we have queried so far
    while (addressesScanned < addressesNew.length) {
        if ((addressesNew.length - addressesScanned) <= params.sqlArgumentsSize) {
            // Send the rest of addresses
            var slice = addressesNew.slice(addressesScanned, addressesNew.length)
        } else {
            // Make an slplice of 1000 addresses
            var slice = addressesNew.slice(addressesScanned,(addressesScanned + params.sqlArgumentsSize))
        }
        
        // Get just the addresses from the slice:
        var addressesSlice = []
        for (var i = 0; i < slice.length; i++) {
            addressesSlice.push(slice[i].hash)
        }
        
        // Multi-select query
        var sqlQuery = await SqlComposer.MultiSelect("Address, BalanceSc, BalanceSf", "AddressesBalance", "Address", addressesSlice, true) 
        var result = await SqlAsync.Sql(params, sqlQuery) // Async call
        currentBalances = currentBalances.concat(result) // Concatenating results to a single array

        addressesScanned = addressesScanned + params.sqlArgumentsSize
    }
    
    // C - Updating the balance of addresses found on the database. For those not found, insert an entry with merged results
    for (var i = 0; i < addressesNew.length; i++) {
        var match = false
        for (var j = 0; j < currentBalances.length; j++) {   
            if (currentBalances[j] != false) { // Some of the SQL query result elements are a false, be careful
                if (currentBalances[j].Address == addressesNew[i].hash) {
                    // Match, update the balance
                    match = true
                    var newSc = currentBalances[j].BalanceSc
                    var newSf = currentBalances[j].BalanceSf
                    if (addressesNew[i].sc > 0 || addressesNew[i].sc < 0) {
                        // Update SC balance
                        if (deleting == true) {
                            newSc = BigInt(newSc) - addressesNew[i].sc // Delete, instead of adding
                        } else {
                            newSc = BigInt(newSc) + addressesNew[i].sc
                        }
                    }
                    if (addressesNew[i].sf > 0 || addressesNew[i].sf < 0) {
                        // Update SF balance
                        if (deleting == true) {
                            newSf = newSf - addressesNew[i].sf // Delete, instead of adding
                        } else {
                            newSf = newSf + addressesNew[i].sf
                        }
                    }

                    // We allow negative balances, as those can be intermediate stages during a block reindexing
                    // To check if it is dust, we calculate the absolute value of the new balance(non negative)
                    // Deleting or updating
                    if (newSf == 0 && Math.abs(Number(newSc)) < params.blockchain.dustThreshold) {
                        // Balances bellow the dust threshold. Delete the entry
                        sqlBatch.push("DELETE FROM AddressesBalance WHERE Address='" + addressesNew[i].hash + "'")
                    } else {
                        // Update
                        sqlBatch.push("UPDATE AddressesBalance SET BalanceSc = " + BigInt(newSc) + ", BalanceSf = " + newSf
                            + " WHERE Address='" + addressesNew[i].hash + "'")
                    }
                }
            }
        }
        if (match == false) {
            // No match, crate a new entry
            var newSc = addressesNew[i].sc
            var newSf = addressesNew[i].sf
            
            if (deleting == true) {
                if (newSf <= -1 || newSc < (params.blockchain.dustThreshold * -1)) {
                    // If the change is negative, create a new entry with that inverted amount. We are deleting, so we need to revert the change
                    newSc = newSc * -1n
                    newSf = newSf * -1
                    sqlBatch.push("INSERT INTO AddressesBalance (Address, BalanceSc, BalanceSf) VALUES ('" + addressesNew[i].hash + "',"
                        + BigInt(newSc) + "," + newSf + ")")
                } else {
                    // If the change is positive delete the entry, we are deleting a block
                    sqlBatch.push("DELETE FROM AddressesBalance WHERE Address='" + addressesNew[i].hash + "'")
                }
            } else {
                if (newSf >= 1 || newSc > params.blockchain.dustThreshold) {
                    // Insert
                    var toAdd = "('" + addressesNew[i].hash + "'," + BigInt(newSc) + "," + newSf + ")"
                    sqlBatch.push(SqlComposer.InsertSql(params, "AddressesBalance", toAdd, addressesNew[i].hash))
                    //sqlBatch.push("INSERT INTO AddressesBalance (Address, BalanceSc, BalanceSf) VALUES ('" + addressesNew[i].hash + "',"
                    //    + BigInt(newSc) + "," + newSf + ")")
                } // Else, it is dust, and we do not create an entry
            }
        }
    }

    return sqlBatch
}
