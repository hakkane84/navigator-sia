// Reindexer.js - A tool for re-indexing an specific block on the database of Navigator-Sia
// Github: https://github.com/hakkane84/navigator-sia
// License: GNU AGPLv3
// Author: Salvador Herrera (keops_cc@outlook.com)

// Usage: type a block height on the command line:
// Example: `node reindexer.js 13521`
// A range of blocks can also be introduced:
// Example: `node reindexer.js 10000 12500` will re-index between blocks 10000 and 12500 (both included)

var fs = require('fs');
var stripJsonComments = require('strip-json-comments')

// Load configuration file
var rawFile = fs.readFileSync("../config.json").toString()
var config = JSON.parse(stripJsonComments(rawFile))

// Loads all the parameters and functions, from the external params.js module
var Params = require('../modules/params.js')
var params = Params.Params(config, "../")

var Indexer = require("../modules/indexer.js")

if (process.argv[3] == null) {
    // Not a range
    var blocks = [parseInt(process.argv[2])]
} else {
    // Range of blocks
    var blocks = []
    for (var i = parseInt(process.argv[2]); i <= parseInt(process.argv[3]); i++) {
        blocks.push(i)
    }
}

setTimeout(function(){
    main(blocks, 0)
}, 3000)

async function main(blocks, i) {
    if (i < blocks.length) {
        var block = blocks[i]

        // Block height input
        console.log("Re-indexing the block #" + block)

        // Deleting the block
        await Indexer.BlockDeleter(params, block)

        // Indexing the block
        var blockStartTime = Math.floor(Date.now() / 1000)
        await Indexer.BlockIndexer(params, block)
        var blockEndTime = Math.floor(Date.now() / 1000)
        console.log("Block " + block + " reindexed in " + (blockEndTime - blockStartTime) + " sec")

        // Next block
        console.log()
        i++
        main(blocks, i)

    } else {
        console.log("DONE\n")

        setTimeout(function(){
            process.exit()
        }, 5000)
    }    
}