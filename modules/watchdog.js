// The watchdog is a Cron routine that will assess that both the API server and the indexing routine are
// alive. For achieving max efficiency, Navigator does not close SQL database connections, so if a script
// fails, the program will not close. If Watchdog finds a script stopped, it will force to close the program,
// allowing PM2 to gracefully restart Navigator
var exports = module.exports={}
var cron = require('cron');
var axios = require('axios')

exports.Watchdog = async function(params, minute) {
    console.log("* Watchdog initialized")

    // Determining cron sentence to allow a check every watchdogInterval minutes after startup,
    var timesPerHour = Math.floor(60 / (params.watchdogInterval))
    var cronPeriods = []
    for (var i = 0; i < timesPerHour; i++) {
        newMinute = Math.floor(minute + i * params.watchdogInterval)
        if (newMinute >= 60) { newMinute = newMinute - 60}
        cronPeriods.push(newMinute)
    }
    cronPeriods = cronPeriods.sort(function(a, b) {return a-b})
    var cronString = "00 "
    for (var i = 0; i < cronPeriods.length; i ++) {
        cronString = cronString + cronPeriods[i]
        if (i != cronPeriods.length-1) {
            cronString = cronString + ","
        }
    }
    cronString = cronString + " * * * *"

    // Cron routine
    var cronJob = cron.job(cronString, function(){
        watchdogRoutine(params)
    })
    cronJob.start();
}


async function watchdogRoutine(params) {
    // Checks the health of the script
    if (params.useSsl == true) {
        var apiAddress = "https://localhost:" + params.httpsPort + "/navigator-api/status"
    } else {
        var apiAddress = "http://" + params.publicIp + ":" + params.httpPort + "/navigator-api/status"
    }
    axios.get(apiAddress).then(async function (response) {
        var status = response.data[0]
        latestHeartbeat = status.heartbeat

        // Current time
        var currentTime = new Date().valueOf()

        // Checking the difference, and deciding if stopping the script or not
        var diff = currentTime - latestHeartbeat
        if (diff > (params.watchdogInterval * 60000)) {
            // The last heartbeat is very old, and the indexer script is probably stopped
            console.log("*** WATCHDOG - The last heartbeat of the Indexer is too old2")
            console.log("*** WATCHDOG - Closing script to allow a gracefull restart by PM2")
            process.exit()
        }
        
    }).catch(async function (error) {
        console.log("*** WATCHDOG - API server is down or `publicIp` setting misconfigured")
        console.log("*** WATCHDOG - Closing script to allow gracefull restart by PM2")
        process.exit()
    }) 
}