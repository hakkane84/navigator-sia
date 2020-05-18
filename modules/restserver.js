// RESTful API server for Navigator
var http = require('http');
var https = require('https');
var express = require('express');
var bodyParser = require('body-parser');
var cron = require('cron');
var fs = require('fs');
var ApiFunctions = require("./apifunctions.js")


exports.Restserver = async function(params) {
    // SSL certs, only if using SSL
    if (params.useSsl == true) {
        var privateKey  = fs.readFileSync(params.sslCertificatesPath + 'navigator.key', 'utf8');
        var certificate = fs.readFileSync(params.sslCertificatesPath + 'navigator.crt', 'utf8');
        var caBundle = fs.readFileSync(params.sslCertificatesPath + 'navigator.ca-bundle');
        var credentials = {key: privateKey, cert: certificate, ca: caBundle};
    }

    // Initializing the express router
    var app = express();
    var router = express.Router(); // get an instance of the express Router
    router.use(bodyParser.urlencoded({limit: '50mb', extended: true, parameterLimit: 1000000}));
    router.use(bodyParser.json({limit: '50mb', extended: true}));

    // Usage stats initialization
    var dayHashCalls = 0
    var dayStatusCalls = 0
    var hourHashCalls = 0
    var hourStatusCalls = 0
    var dayBlockedCalls = 0
    var hourBlockedCalls = 0
    var dayIPrequests = [] // Logs the amount of requests from each IP, to band them if misusing the API
    var maxRequestsPerIP = params.apiLimits.apiLimitPerIp
    var IPwhiteList = params.apiLimits.apiWhitelist
    var IPblackList = params.apiLimits.apiBlacklist


    // =============================
    //          Middleware
    // =============================

    // This prevents CORS issues:
    router.use((req,res,next) => {
        res.header("Access-Control-Allow-Origin", "*");
        res.header(
            "Access-Control-Allow-Headers",
            "Origin, X-Requested-With, Content-Type, Accept, Authorization"
        );
        if (req.method === 'OPTIONS') {
            res.header('Access-Control-Allow-Methods', 'GET', 'POST')
            return res.status(200).json({})
        }
        next();
    })

    // Middleware to use for all requests
    router.use(function(req, res, next) {
        //Loging of calls
        dayHashCalls++
        hourHashCalls++

        var IpIsAllowed = true // By default, all requests are allowed

        // Checking the blacklist
        for (var a = 0; a < IPblackList.length; a++) {
            if (IPblackList[a] == req.connection.remoteAddress) {
                IpIsAllowed = false
            }
        }
        
        // Checking the IP stats of the day
        if (maxRequestsPerIP != 0) {
            var IpMatch = false
            for (var b = 0; b < dayIPrequests.length; b++) {
                if (dayIPrequests[b].ip == req.connection.remoteAddress) {
                    IpMatch = true
                    if (dayIPrequests[b].count > maxRequestsPerIP) {
                        if (IpIsAllowed = false) { // Adds this log line only if it is not an IP already blacklisted
                            //console.log("IP blocked for excessive requests: " + req.connection.remoteAddress)
                        }
                        IpIsAllowed = false
                    } else {
                        dayIPrequests[b].count++ // Adds to the count of requests
                    }
                }
            }
            if (IpMatch == false) { // If not in the database of IPs, add entry
                dayIPrequests.push({ip: req.connection.remoteAddress, count: 1})
            }
        }

        // Checking the whitelist
        for (var c = 0; c < IPwhiteList.length; c++) {
            if (IPwhiteList[c] == req.connection.remoteAddress) {
                IpIsAllowed = true
            }
        }

        if (IpIsAllowed == true) {
            next(); // make sure we go to the next routes and don't stop here
        } else {
            //console.log("IP blocked: " + req.connection.remoteAddress)
            dayBlockedCalls++
            hourBlockedCalls++
            res.status(429);
            res.send("You have reached the cap of" + maxRequestsPerIP 
                + " daily requests to this API, established to avoid unnecesary abuse. For unlimited access, please contact us")
        }
    });


    // =============================
    //      Routes for the API
    // =============================


    // Test route to make sure everything is working (accessed at GET http://localhost:3000/navigator-api)
    router.get('/navigator-api/', function(req, res) {
        res.json({ message: "Welcome to the API of of Navigator. Check siastats.info/api for documentation"});   
    });


    // All the requests start requesting a hash type, and depending on it, further SQL queries will be done
    // For details about the flow of the queries, check the schematic on the project documentation
    // Routes for /hash/:hash_id (accessed at GET http://localhost:3000/navigator-api/hash/:hash_id)
    router.route('/navigator-api/hash/:hash_id').get(function(req, res) {
        ApiFunctions.Hash(params, res, req)
    });


    // Unspent outputs of an address
    // Routes for /unspent_outputs/:hash_id (accessed at GET http://localhost:3000/navigator-api/unspent_outputs/:hash_id)
    router.route('/navigator-api/unspent_outputs/:hash_id').get(function(req, res) {
        ApiFunctions.UnspentOutputs(params, res, req)
    });


    // Raw data of the hash directly from the explorer module
    // Routes for /raw/:hash_id (accessed at GET http://localhost:3000/navigator-api/raw/:hash_id)
    router.route('/navigator-api/raw/:hash_id').get(function(req, res) {
        if (params.explorerAvailable != true) {
            // Navigator owner is not supporting the explorer module in settings
            res.status(400).send('This API endpoint is not supported by the owner')
        } else {
            ApiFunctions.Raw(params, res, req)
        }
    });


    // Checks a batch of addresses (accessed at POST http://localhost:3500/api/addresses)
    router.route('/navigator-api/addresses')
    .post(async function(req, res) {
        ApiFunctions.AddressesBatch(params, res, req)
    });


    // Checks a processed file of host contracts (accessed at POST http://localhost:3500/navigator-api/host-contracts)
    router.route('/navigator-api/host-contracts')
    .post(async function(req, res) {
        ApiFunctions.ContractsBatch(params, res, req)
    });


    // CSV file report route
    router.route('/navigator-api/csv-file')
    .post(async function(req, res) {
        if (params.useCoinGeckoPrices != true) {
            // Navigator owner is not supporting the CoinGecko coin price tracking in settings
            res.status(400).send('This API endpoint is not supported by the owner')
        } else {
            ApiFunctions.CsvFile(params, res, req)
        }
    });


    // Evolution of the balance of an address or batch of addresses
    router.route('/navigator-api/balance-track')
    .post(async function(req, res) {
        if (params.useCoinGeckoPrices != true) {
            // Navigator owner is not supporting the CoinGecko coin price tracking in settings
            res.status(400).send('This API endpoint is not supported by the owner')
        } else {
            ApiFunctions.BalanceTrack(params, res, req)
        }
    })


    // Status request: returns the current highest block in the blockchain, in the database and the timestamp of the last check
    router.get('/navigator-api/status', function(req, res) {
        // Logging activity
        dayStatusCalls++
        hourStatusCalls++
        
        // Reads the file status.json     
        try {
            var data = fs.readFileSync("./status.json")
            var statusResponse = JSON.parse(data)
        } catch(e) {
            var statusResponse = []
        }

        if (statusResponse[0].lastblock == undefined) {
            // Try again in 1 second, sometimes the file is still being handled by another process
            setTimeout(function(){
                try {
                    var data = fs.readFileSync("./status.json")
                    var statusResponse = JSON.parse(data)
                } catch(e) {
                    var statusResponse = []
                }
                res.json(statusResponse);
            }, 5000)
            
        } else {
            res.json(statusResponse);
        }
    });


    // Landing page stats: returns the last 10 TX of each kind and the distribution of the last 10 000 transactions of the network
    router.get('/navigator-api/landing', function(req, res) {
        // Reads the file landingpagedata.json
        try {
            var data = fs.readFileSync("./landingpagedata.json")
            var statusResponse = JSON.parse(data)
        } catch(e) {
            var statusResponse = []
        }
        res.json(statusResponse);
    });


    // QR code server
    router.get('/navigator-api/qr/:hash', function(req, res) {
        ApiFunctions.Qr(params, res, req)
    });


    // Blockchain reorganizations
    router.get('/navigator-api/reorgs', function(req, res) {
        ApiFunctions.Reorgs(params, res, req)
    });


    // Website server: home page (not an html file)
    router.get(('/' + params.htmlPath), function(req, res) {
        var mimeType = "text/html"
        res.writeHead(200, mimeType);
        var fileStream = fs.createReadStream(params.websitePath + "navigator.html");
        fileStream.pipe(res);
    });


    // Rest of static content
    router.use(express.static(params.websitePath))


    // HTCPCP compliance :-)
    router.route('/navigator-api/coffee').get(function(req, res) {
        res.status(418).send('Sorry, I am a teapot, not a coffe maker')
    });


    // =============================================
    //                 END OF PATHS
    // =============================================



    // All the routes will be prefixed with /navigator-api
    app.use('/', router);

    // Creating server
    if (params.useSsl == false) {
        // HTTP
        var httpServer = http.createServer(app)
        httpServer.listen(params.httpPort)
        httpServer.timeout = params.apiTimeout // Timeout of requests
        console.log('* API HTTP server running on port: ' + params.httpPort)
    } else {
        // HTTPS
        var httpsServer = https.createServer(credentials, app);
        httpsServer.listen(params.httpsPort)
        httpsServer.timeout = params.apiTimeout // Timeout of requests
        console.log('* API HTTPS server running on port: ' + params.httpsPort)
    }
    

    // Optional hourly statistics of usage
    if (params.hourlyApiLogs == true) {
        var cronJob = cron.job("00 00 * * * *", function(){
            var hourAPIcalls = hourHashCalls - hourStatusCalls - hourBlockedCalls
            console.log("+++ Usage in the last hour: " + hourAPIcalls + " API calls, " + hourStatusCalls + " web calls +++")
            hourHashCalls = 0
            hourStatusCalls = 0
            hourBlockedCalls = 0
        })
        cronJob.start();
    }

    // Optional daily statistics of usage
    if (params.dailyApiLogs == true) {
        var cronJob2 = cron.job("10 00 00 * * *", function(){
            var dayAPIcalls = dayHashCalls - dayStatusCalls - dayBlockedCalls
            console.log()
            console.log("----------------------------------------------------------------------------")
            console.log("+++                     NAVIGATOR DAILY USAGE REPORT                     +++")
            console.log("+++ Usage in the last 24h: " + dayAPIcalls + " API calls, " + dayStatusCalls + " web calls +++")
            console.log("----------------------------------------------------------------------------")
            console.log("+++ Users:")
            for (var d = 0; d < dayIPrequests.length; d++) {
                console.log(dayIPrequests[d].ip + " --> " + dayIPrequests[d].count + " calls")
            }
            console.log("----------------------------------------------------------------------------")
            dayHashCalls = 0
            dayStatusCalls = 0
            dayBlockedCalls = 0
            dayIPrequests = [] // Resets the list of IP requests
        })
        cronJob2.start();
    }
}
