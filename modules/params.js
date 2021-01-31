// Additional configuration and initial setup of Navigator

var exports = module.exports={}
var fs = require('fs');
var sql = require('mssql');
var sqLite = require('sqlite3').verbose()

exports.Params = function(config, scriptPath) 
{
    // Navigator database location path for SQLite (not necessary if MS SQL Server is used instead). Default: leave it as the
    // variable scriptPath (which will be "./")
    var sqliteDbPath = scriptPath

    // Path of the website files inside the Navigator folder. If you are usuing your own web server for placing, change this variable to the
    // path were `navigator.html` and the `nav_assets` folder are available
    var websitePath = scriptPath + "web/"

    // Website path inside your domain. This is the external address where Navigator will be available. By default: "" (wich is your host address, "xxx.xxx.xxx.xxx/").
    // Other example could be "/index" ("xxx.xxx.xxx.xxx/index") or "/explorer"
    var htmlPath = ""

    // Set this to false if you don't want Navigator to inject the customization variables into the css and js files. This will be tipically the case if you have modified
    // dramatically the code of the site beyond thes settings in this file and config.js, and don't want them to be overwritten when navigator.js starts up
    var injectWebsiteOnStartup = true

    // Time between sia API consensus calls to check the addition of a new block to the blockchain, in milliseconds. Default: 10000 (10 sec)
    var consensusCheckTime = 10000

    // Timeout when all the routers are unavailable on a Sia API call. It will try again after this delay. Default: 5 minutes (300000)
    var routerTimeout = 300000

    // Number of blocks to be deleted from the database on a new script startup. Default: 3
    var purgeBlocksOnStartup = 3

    // Watchdog interval for detecting issues. Default: 15 minutes. Not recommended a value bellow 10 or above 30
    var watchdogInterval = 15

    // Batch limit: the max amount of addresses or contracts that will be accepeted by the API server to be processed in batch. A higher limit can
    // result in excessive overload of the server or other issues. 50000 is a safe number. 100000 is realistic in higher-end server
    var apiBatchLimit = 100000

    // API server timeout. By default 120000 milliseconds (2 minutes)
    var apiTimeout = 120000

    // Sia blockchain parameters
    var blockchain = {
        genesisDifficulty: 34359738367,
        genesisHashrate: 0,
        initialBlockReward: BigInt(300000000000000000000000000000),
        endBlockReward: BigInt(30000000000000000000000000000),
        decayBlockReward: BigInt(1000000000000000000000000), // Reduction of the reward on each block
        hashrateEstimationBlocks: 200, // Number of previous blocks used to estimate the network hashrate. The default of 200 is the same used by the Sia Explorer module,
        siafundFees: 0.039,
        totalSiafunds: 10000,
        dustThreshold: 1000000000000000000000, // Arbitrary. Bellow this threshold, we consider the amount as "dust" and wont compute it for balances of addresses. 1 milliSia by default
        coinPrecision: 1000000000000000000000000, // How many Hastings make a coin
        foundationForkHeight: 298000,
        foundationInitialSubsidy: BigInt(1576800000000000000000000000000000),
        foundationSubsidy: BigInt(129600000000000000000000000000000),
        foundationSubsidyPeriodicity: 4320,
        foundationInitialAddress: "053b2def3cbdd078c19d62ce2b4f0b1a3c5e0ffbeeff01280efb1f8969b2f5bb4fdc680f0807",
        foundationInitialFailsafeAddress: "27c22a6c6e6645802a3b8fa0e5374657438ef12716d2205d3e866272de1b644dbabd53d6d560",
        foundationSpecifier: "foundation" // String used to hash the OutputID of Foundation subsidies
    }

    // SQL database connection
    if (config.useMsSqlServer == true) {
        var sqLiteDb = null
        
        // Single MS-SQL connection pool accross every route
        var msSqlPoolPromise = new sql.ConnectionPool(config.sqlLogin)
        .connect()
        .then(pool => {
            console.log('* Connected to MS-SQL!')
            return pool
        })
        .catch(err => console.log('//// MS-SQL Database Connection Failed! Bad Config: ', err))
    } else {
        var msSqlPoolPromise = null
        
        // SQLite
        var sqLiteDb = new sqLite.Database(sqliteDbPath + 'navigator.db', (err) => {
            if (err) {
                console.error('//// SQLite Database Connection Failed! Error: ', err.message);
            } else {
                console.log('* Connected to the SQLite database!')
            }
        });
    }

    // SQL arguments size is the limit of the number of WHERE statements on a single SELECT statement. 1000 works
    // nicely on my system, change it if the SQL controller is having difficulties
    // For SQLite, 950 is the absolute max
    if (config.useMsSqlServer == true) {
        // Change this if using MS SQL Server. 1000 should work well
        var sqlArgumentsSize = 1000
    } else {
        // This is for SQLite. 950 is the top possible limit
        var sqlArgumentsSize = 950
    }
    

    // Exchange rates for these currencies. A table with the exchange rates will be created to be used on the .CSV reports
    var exchangeCurrencies = [
        "USD",
        "AUD",
        "BTC",
        "CAD",
        "CHF",
        "CNY",
        "EUR",
        "GBP",
        "HKD",
        "ILS",
        "INR",
        "JPY",
        "KRW",
        "MXN",
        "NOK",
        "NZD",
        "PLN",
        "RUB",
        "SEK",
        "SGD",
        "TRY",
        "TWD",
        "UAH",
        "ZAR",
    ]

    // Reading the mining pools addresses book
    var rawFile = fs.readFileSync(scriptPath + "poolAddresses.json")
    var poolsDb = JSON.parse(rawFile)

  
    // Mega-array containing all the parameters, to easily pass from one script to the next
    var params = {
        explorerAvailable: config.explorerAvailable,
        useCoinGeckoPrices: config.useCoinGeckoPrices,
        useRouters: config.useRouters,
        localDaemon: config.localDaemon,
        siaRouters: config.siaRouters,
        siaRoutersAuthkey: config.siaRoutersAuthkey,
        routerTimeout: routerTimeout,
        sqlLogin: config.sqlLogin,
        useMsSqlServer: config.useMsSqlServer,
        msSqlPoolPromise: msSqlPoolPromise,
        sqLiteDb: sqLiteDb,
        sqlArgumentsSize: sqlArgumentsSize,
        exchangeCurrencies: exchangeCurrencies,
        websitePath: websitePath,
        injectWebsiteOnStartup: injectWebsiteOnStartup,
        htmlPath: htmlPath,
        watchdogInterval: watchdogInterval,
        consensusCheckTime: consensusCheckTime,
        purgeBlocksOnStartup: purgeBlocksOnStartup,
        blockchain: blockchain,
        poolsDb: poolsDb,
        httpPort: config.httpPort,
        httpsPort: config.httpsPort,
        publicIp: config.publicIp,
        apiTimeout: apiTimeout,
        useSsl: config.useSsl,
        sslCertificatesPath: config.sslCertificatesPath,
        apiLimits: {
            apiLimitPerIp: config.apiLimitPerIp,
            apiWhitelist: config.apiWhitelist,
            apiBlacklist: config.apiBlacklist
        },
        verboseApiLogs: config.verboseApiLogs,
        hourlyApiLogs: config.hourlyApiLogs,
        dailyApiLogs: config.dailyApiLogs,
        colors: config.colors,
        apiBatchLimit: apiBatchLimit,
        donationAddress: config.donationAddress,
        githubRepository: config.githubRepository,
        landingRefreshPeriod: config.landingRefreshPeriod
    }

    return params
}
