// Miscelaneous functions, including calls to the Sia daemon
var exports = module.exports={}
var sia = require('sia.js');
var axios = require('axios')
var request = require('request')
var Commons = require('./commons.js')

exports.MegaRouter = async function(params, routerNum, call, oneTry) {
    // Handles an API request to Sia either to a router or to a local Sia node
    // oneTry == true means that we only attempt this call once, to avoid abuses from the API server with malformed requests
    if (params.useRouters == true) {

        // Handles the request to a router, cycling among available routers on failover and pausing if no router is working
        var api = await siaGetCall(params.siaRouters[routerNum], params.siaRoutersAuthkey, call)
        if (api != null) {
            return api
        } else {
            if (oneTry == true) {
                // Return null, don't repeat
                return null
            } else {
                // Try next router
                routerNum++
                if (routerNum >= params.siaRouters.length) {
                    // This was the last router. Timeout and try again with router 0
                    console.log("// All routers are unavailable on a " + call + " call. Timing out " + params.routerTimeout + "ms")
                    await Commons.Delay(params.routerTimeout); // Timeout
                    api = await Commons.MegaRouter(params, 0, call)
                    return api

                } else {
                    console.log("// Router #" + routerNum + " unavailable on a " + call + " call")
                    await Commons.Delay(1000); // One second sanity delay
                    api = await Commons.MegaRouter(params, routerNum, call)
                    return api
                }
            }
        }

    } else {
        // Handles the request to a local Sia node
        var api = await siaLocalCall(params, call)
        if (api != null) {
            return api
        } else {
            if (oneTry == true) {
                // Return null, don't repeat
                return null
            } else {
                console.log("// Local Sia node unavailable for a " + call + " call. Timing out " + params.routerTimeout + "ms")
                // Repets the call after a timeout
                await Commons.Delay(params.routerTimeout); // Timeout
                api = await Commons.MegaRouter(params, 0, call)
                return api
            }
        }
    }
       
}


async function siaGetCall(router, routerAuthKey, call) {
    // GET call to a Sia router
    try {
        var result = await axios.post(router, {
            wrapper: 'sia',
            ip: "localhost:9980",
            call: call,
            authkey: routerAuthKey
        })
        .then(function (response) {
            // Succeded router call
            return response.data
        })
        .catch(function (error) {
            // Failed router call. Returns null as a way to report the failure to the mega-router
            return null
        });

        return result
    } catch (e) {
        // Returns a null as a way to indicate the call failed
        return null
    }
}


async function siaLocalCall(params, call) {
    // APi call to the local Sia daemon
    try {
        var siad = await sia.connect(params.localDaemon)
        var api = await siaCall(params, call)
        if (api != null) {
			api = JSON.parse(api)
		}
        return api
    } catch(e) {
        // Returns a null as a way to indicate the call failed
        return null
    }
}

// Custom Sia call with an extended timeout, replacing the Sia.js method
const siaCall = (params, call) => new Promise((resolve, reject) => {
	const callOptions = {
		url: "http://" + params.localDaemon + call,
		timeout: 60000,
		headers: {'User-agent': 'Sia-Agent'}
	}
	request(callOptions, (err, res, body) => {
		if (!err && (res.statusCode < 200 || res.statusCode > 299)) {
			reject(body)
		} else if (!err) {
			resolve(body)
		} else {
			reject(err)
		}
	})
})


exports.Delay = function(ms) {
    // An async timeout
    return new Promise(function (resolve) { 
        return setTimeout(resolve, ms); 
    });
}

exports.SortNumber = function(a, b) {
    // Sorts numbers propeprly
    return a - b;
}

exports.GetStartDayTimestamp = function(timestamp) {
    // From a given timestamp, finds the unix timestamp of the beginning of that day. Also akes it in seconds
    var t = new Date(timestamp)
    y = t.getFullYear()
    m = t.getMonth()
    d = t.getDate()
    dateTimestamp = new Date(y, m, d, 0, 0, 0, 0).getTime()
    dateTimestamp = parseInt(dateTimestamp / 1000)
    return dateTimestamp
}