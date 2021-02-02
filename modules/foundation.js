// Processes operations related to the Sia Foundation subsidies and wallets
var exports = module.exports={}
var blake = require('blakejs')


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