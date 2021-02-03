// Processes operations related to the Sia Foundation subsidies and wallets
var exports = module.exports={}
var blake = require('blakejs')

var SqlAsync = require('./modules/sql_async.js')
var SqlComposer = require("./modules/sql_composer.js")
var Commons = require('./commons.js')


exports.CalculateOutputIdSubsidy = async function(blockHash, specifier) {
	// This function takes the hash of a block together with the specifier of the Sia Foundation and calculates
	// with it the OutputID of a Foundation subsidy. It reproduces what the Sia code does in Golang
	// This function is a courtesy of Nate Maninger, from https://SiaCentral.com, whom I am extremely grateful with for his help
	
	var specifierFoundation = newSpecifier(specifier);

	function newSpecifier(str) {
		// Takes the specifier and transforms it into a buffer
		const buf = Buffer.alloc(16);
		buf.write(str, encoding='ascii');
		return buf;
	}

	function hashAll(...args) {
		// Calculates the subsidy ID by hashing together the block ID bytes and foundation specifier

		const hasher = blake.blake2bInit(32, null);

		// loop through each of our arguments and update the hasher
		for (let i = 0; i < args.length; i++)
		blake.blake2bUpdate(hasher, args[i]);

		//finalize the hash
		return blake.blake2bFinal(hasher);
	}

	// convert the block ID from its hex encoded string to a Buffer
	var blockID = Buffer.from(blockHash, 'hex');
	// calculate the subsidy id
	var subsidyOutputID = hashAll(blockID, specifierFoundation);
	// convert the Buffer to a hex encoded ID string
	var  outputIDString = Buffer.from(subsidyOutputID).toString('hex');

	return outputIDString
}


exports.CheckCurrentFoundationAddresses = async function(params) {
	// Checks with the Sia API if the Foundation or failover addresses have changed. If yes, it will update
	// the table and reasign the unspent outputs to the new address

	// Getting the latest set of addresses
	var sqlQuery = SqlComposer.SelectTop(params, "FoundationAddressesChanges", "*", "Height", 1)
	var sql = await SqlAsync.Sql(params, sqlQuery)

	// Current addresses from the Sia API
	var api = await Commons.MegaRouter(params, 0, '/consensus')
    var currentFoundationAddress = api.foundationprimaryunlockhash
	var currentFailoverAddress = api.foundationfailsafeunlockhash
	var height = api.height

	// Detecting a change on any of the two addresses. We will add a new entry if there was a change
	if (sql[0].FoundationAddress != currentFoundationAddress || sql[0].FailoverAddress != currentFailoverAddress) {

		// Inserting new entry on the Foundation addresses table
		var sqlQuery = "INSERT INTO FoundationAddressesChanges (Height,FoundationAddress,FailoverAddress) VALUES "
        	+ "(" + height + ",'" + foundationAddress + "','" + failoverAddress + "')"
		await SqlAsync.Sql(params, sqlQuery)

		if (sql[0].FoundationAddress != currentFoundationAddress) {
			// Main Foundation address changed
			console.log("**** Foundation address changed on block " + height + " to: " + currentFoundationAddress)
			
			// The ownership of all the unspent outputs of the Foundation need to be transferred to the new address
			// A - Getting the list of outputs
			var sqlQuery = "SELECT * FROM Outputs WHERE Spent = 0 AND FoundationUnclaimed = 1 AND Address = '" + sql[0].FoundationAddress + "'"
			var outputsList = await SqlAsync.Sql(params, sqlQuery)
			console.log("**** Updating the ownership of" + outputsList.length + " outputs")

			// B - Updating Outputs
			var sqlQuery = "UPDATE Outputs SET Address = '" + currentFoundationAddress + "' WHERE Spent = 0 AND FoundationUnclaimed = 1"
				+ "AND Address = '" + sql[0].FoundationAddress + "'"
			await SqlAsync.Sql(params, sqlQuery)

			// C - Updating AddressesChanges
			for (var i = 0; i < outputsList.length; i++) {
				var sqlQuery = "UPDATE AddressChanges SET Address = '" + currentFoundationAddress + "' WHERE Address = '" + sql[0].FoundationAddress 
					+ "' AND Height = " + outputsList[i].CreatedOnBlock
				await SqlAsync.Sql(params, sqlQuery)
			}

		} else {
			// Just the failover address changed. No need to update outputs
			console.log("**** Foundation failover address changed on block " + height + " to: " + currentFailoverAddress)
		}
	}
}