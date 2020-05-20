var theme = {
	accent: '#1a874b',
	accentFaded1: '#49664e',
	accentFaded2: '#427c4b',
	decoration: '#7e9489',
	decorationSubtle: '#3e664e',
	decorationContrast: '#9eb4a9',
	background: '#2b2f2d',
	green: '#5cae81',
	darkGreen: '#2ba84b',
	yellow: '#aba147',
	red: '#dd5e5e',
	brightRed: '#dd4444',
	lime: '#809741',
	text: '#c0c0c0',
	boxHeaders: '#777777',
	black: '#000000',
	white: '#ffffff',
	grey1: '#333333',
	grey2: '#666666',
	grey3: '#888888',
	grey4: '#bbbbbb',
	footerText: '#c0c0c0',
	tableBorders: '#333333',
}
var htmlPath = ''
var landingRefreshPeriod = 15000
var donationAddress = 'bde3467039a6d9a563224330ff7578a027205f1f2738e1e0daf134d8ded1878cf5870c41927d'
var githubRepository = 'https://github.com/hakkane84/navigator-sia'
var useCoinGeckoPrices = true
// INJECTION POINT *************************************************************
// Important: Do not edit or delete the line above
// These default variables will be replaced by those injected during the startup


// Website scripts for Navigator 
// Github: https://github.com/hakkane84/navigator-sia
// License: GNU AGPLv3

var apiPath = "/navigator-api"

// Automatically click on the default tab of the search bar
document.getElementById("defaultOpen").click(); 
function openTab(evt, cityName) {
    // Declare all variables
    var i, tabcontent, tablinks;

    // Get all elements with class="tabcontent" and hide them
    tabcontent = document.getElementsByClassName("tabcontent");
    for (i = 0; i < tabcontent.length; i++) {
        tabcontent[i].style.display = "none";
    }

    // Get all elements with class="tablinks" and remove the class "active"
    tablinks = document.getElementsByClassName("tablinks");
    for (i = 0; i < tablinks.length; i++) {
        tablinks[i].className = tablinks[i].className.replace(" active", "");
    }

    // Show the current tab, and add an "active" class to the button that opened the tab
    document.getElementById(cityName).style.display = "block";
    evt.currentTarget.className += " active";
}


// Handling POST requests
    
    // HOST CONTRACTS BATCH SEARCH
    $("button[name = 'hostContracts']").click(function(){
        // Hiding elements
        document.getElementById("header").style.display = 'none'; 
        document.getElementById("inset").style.display = 'none'
        document.getElementById("content").style.display = 'none'
        document.getElementById("content2").style.display = 'none'
        document.getElementById("content3").style.display = 'none'
        document.getElementById("content4").style.display = 'none'
        document.getElementById("content5").style.display = 'none'
        document.getElementById("content6").style.display = 'none'
        document.getElementById("loader").style.display = 'block'
        document.getElementById("loader2").style.display = 'block'
        document.getElementById("loader4").style.display = 'block'
        document.getElementById("statCardsContainer").style.display = 'none'
        document.getElementById("txListContainer").style.display = 'none'


        query = document.getElementById("hostContractsInput").value

        var pathPost = apiPath + "/host-contracts"
        $.post(pathPost,
        {
            query: query,
        },
        function(data,status){

            renderHostContractsSummary(data)

            renderHostTimeline(data)

            document.getElementById("loader").style.display = 'none'
            document.getElementById("loader2").style.display = 'none'
            document.getElementById("loader4").style.display = 'none'
            adjustWidth()
        });
    });

    function renderHostContractsSummary(data) {
        var failRate = ((parseInt(data[0].countfail) / (parseInt(data[0].countfail) + parseInt(data[0].countsuccess) + parseInt(data[0].countunused)))*100).toFixed(1)
        var totalContracts = data[0].countongoing + data[0].countsuccess + data[0].countfail + data[0].countunused
        // Renders the balance table of the batch of wallets
        var tableCode = '<div class="home-outer" style="height:400px">'
            + '<div class="home-inner table-address" style="padding: 0px 25px; width: 550px">'
                + '<div class="home-element">'
                    + '<table id="table-fill" class="table-outer" style="margin: 0px">'
                        + '<thead>'
                            + '<tr style="height: 25px;">'
                                + '<th colspan="2" class="text-left" style="height: 25px; padding: 0px 10px">'
                                    + '<span style="vertical-align:center; margin: 0px 0px 0px 5px"><strong><font size="3">Host contracts summary:</font></strong></span>'
                                + '</th>'
                            + '</tr>'
                            + '<tr>'
                                + '<td style="height: 40px; padding: 0px 15px; font-size:100%; vertical-align:center;"> Contracts found on the blockchain</td>'
                                + '<td style="height: 40px; padding: 0px 15px; font-size:100%; vertical-align:center; text-align: right">' + totalContracts + '</td>'
                            + '</tr>'
                            + '<tr>'
                                + '<td style="height: 40px; padding: 0px 15px; font-size:100%; vertical-align:center;"> Ongoing contracts </td>'
                                + '<td style="height: 40px; padding: 0px 15px; font-size:100%; vertical-align:center; text-align: right">' + data[0].countongoing + '</td>'
                            + '</tr>'
                            + '<tr>'
                                + '<td style="height: 40px; padding: 0px 15px; font-size:100%; vertical-align:center;"> Completed: succeded </td>'
                                + '<td style="height: 40px; padding: 0px 15px; font-size:100%; vertical-align:center; text-align: right">' + data[0].countsuccess + '</td>'
                            + '</tr>'
                            + '<tr>'
                                + '<td style="height: 40px; padding: 0px 15px; font-size:100%; vertical-align:center;"> Completed: failed </td>'
                                + '<td style="height: 40px; padding: 0px 15px; font-size:100%; vertical-align:center; text-align: right">' + data[0].countfail + '</td>'
                            + '</tr>'
                            + '<tr>'
                                + '<td style="height: 40px; padding: 0px 15px; font-size:100%; vertical-align:center;"> Completed: unused </td>'
                                + '<td style="height: 40px; padding: 0px 15px; font-size:100%; vertical-align:center; text-align: right">' + data[0].countunused + '</td>'
                            + '</tr>'
                            + '<tr>'
                                + '<td style="height: 40px; padding: 0px 15px; font-size:100%; vertical-align:center;"> Failure rate </td>'
                                + '<td style="height: 40px; padding: 0px 15px; font-size:100%; vertical-align:center; text-align: right">' + failRate + '%</td>'
                            + '</tr>'
                            + '<tr>'
                                + '<td style="height: 40px; padding: 0px 15px; font-size:100%; vertical-align:center;"> Net revenue from succeeded contracts</td>'
                                + '<td style="height: 40px; padding: 0px 15px; font-size:100%; vertical-align:center; text-align: right">' + readable(data[0].revenuegain) + ' SC</td>'
                            + '</tr>'
                            + '<tr>'
                                + '<td style="height: 40px; padding: 0px 15px; font-size:100%; vertical-align:center;"> Lost from failed contracts</td>'
                                + '<td style="height: 40px; padding: 0px 15px; font-size:100%; vertical-align:center; text-align: right">' + readable(data[0].revenuelost) + ' SC</td>'
                            + '</tr>'
                            + '<tr>'
                                + '<td style="height: 40px; padding: 0px 15px; font-size:100%; vertical-align:center;"> Total net revenue</td>'
                                + '<td style="height: 40px; padding: 0px 15px; font-size:100%; vertical-align:center; text-align: right">' + readable(data[0].revenuenet) + ' SC</td>'
                            + '</tr>'
                        + '</thead>'
                    + '</table>'
                + '</div>'
            + '</div>'
            + '<div class="home-inner table-outer" style="width: 550px; height:450px; padding: 0px 0px 0px 25px">'
                + '<div id="card" style="height:175px; text-align: center">'
                    + '<div class="container" id = "container" style = "height: 385px; margin: 0px auto" bgcolor="' + theme.black + '"></div>'
                + '</div>'
            + '</div>'
        + '</div>'
            
        document.getElementById('content5').innerHTML = tableCode
        document.getElementById("content5").style.display = 'block'

        renderHostChart(data)
        
    }

    function renderHostChart(data) {
        // Adds a Highcharts pie chart on the container div created on the parent function  t
        $('#container').highcharts({
            chart: {
                backgroundColor: theme.black,
                plotBorderWidth: 0,
                plotShadow: false,
                spacingTop: 50,
            },
            colors: [
                theme.green,
                theme.yellow,
                theme.red
            ],
            title: {
                text: '<b>Completed contracts</b>',
                align: 'center',
                verticalAlign: 'top',
                y: -20,
                style: {
                    color: theme.boxHeaders,
                    fontFamily: 'Lato',
                    fontSize:'18px',
                    fontWeight: '700'
                }
            },
            plotOptions: {
                pie: {
                    allowPointSelect: true,
                    cursor: 'pointer',
                    showInLegend: false,
                    dataLabels: {
                        enabled: true,
                        style: {
                            color: theme.white
                        }
                    }
                },
            },
            credits:{enabled:false},
            series: [{
                type: 'pie',
                name: 'Completed contracts',
                innerSize: '30%',
                data: [
                    ['Succeeded',   data[0].countsuccess],
                    ['Unused',   data[0].countunused],
                    ['Failed',   data[0].countfail]]
            }]
        });
    }

    function renderHostTimeline(data) {
        // Shows a timeline representation of the contract

        // A table header
        var div = document.createElement('div');
        div.className = 'row';
        div.innerHTML =
            '<div style="margin: 100">'
                + '<table id="table-fill" class="table-outer" style="width: 1150px; height: 25px; margin: 0px auto; box-shadow: none">' 
                    + '<thead>'
                        + '<tr>'
                            + '<th class="text-left">'
                                + '<span style="vertical-align:center; margin: 0px 0px 0px 5px"><strong><font size="3">File Contracts timeline:</font></strong></span>'
                            + '</th>'
                        + '</tr>'
                    + '</thead>'
                + '</table>'
                + '<div id="timeline" class="table-outer" style="height: 800px; margin: 0px auto; padding: 0px auto; width: 1150px" ></div>'
            + '</div>'
        document.getElementById('content6').appendChild(div);
        document.getElementById("content6").style.display = 'block'
        
        // Google charts timeline
        google.charts.load('current', {'packages':['timeline']});
        google.charts.setOnLoadCallback(drawChart);
        function drawChart() {

            // Preparing the data array
            var array = []
            var colors = []
            for (var i = 0; i < data[1].contracts.length; i++) {
                var c = data[1].contracts[i]
                if (c.statusnavigator == "ongoing") {
                    newColor = theme.text
                } else if (c.statusnavigator == "complete-succ") {
                    newColor = theme.green
                } else if (c.statusnavigator == "complete-fail") {
                    newColor = theme.red
                } else {
                    newColor = theme.yellow
                }
                colors.push(newColor)
                var timestamp = parseInt(c.timestamp)
                var contractStart = new Date(timestamp * 1000)
                var contractEndPre = timestamp + (c.duration * 600)
                var contractEnd = new Date(contractEndPre * 1000)
                var row = ["c" + i, c.contractId, customHTMLTooltip(c, newColor), contractStart, contractEnd]
                array.push(row)
                
            }
            
            //Rendering
            var container = document.getElementById('timeline');
            document.getElementById('content6').appendChild(div);
            var chart = new google.visualization.Timeline(container);
            var dataTable = new google.visualization.DataTable();

            dataTable.addColumn({ type: 'string', id: 'Contract' });
            dataTable.addColumn({ type: 'string', id: 'Name' });
            dataTable.addColumn({ type: 'string', role: 'tooltip', p: {'html': true}});
            dataTable.addColumn({ type: 'date', id: 'Start' });
            dataTable.addColumn({ type: 'date', id: 'End' });
            
            dataTable.addRows(array)

            var options = {
                timeline: { showBarLabels: false, 
                    rowLabelStyle: { color: "#444", fontSize: 11 }, 
                    barLabelStyle: { fontSize: 3 }  // Reduces the height of the rows
                },
                colors: colors,
                // Use an HTML tooltip.
                tooltip: { isHtml: true },
                backgroundColor: theme.tableBorders,
            };
            
            // This block of code changes the color of the time axis labels
            google.visualization.events.addListener(chart, 'ready', function () {
                var labels = container.getElementsByTagName('text');
                Array.prototype.forEach.call(labels, function(label) {
                    label.setAttribute('fill', theme.text);
                });
            });

            chart.draw(dataTable, options);
        }
    }

    function customHTMLTooltip(c, newColor) {
        var start = timeConverter(c.timestamp)
        var endPre = parseInt(c.timestamp) + (c.duration * 600)
        var end = timeConverter(endPre)
        var duration = Math.round(c.duration/144)
        var size = (c.filesize / 1000000000).toFixed(2)
        return '<div style="padding: 10px;"><span style="font-weight: 700"> Contract ID: ' + c.contractId + '</span><br>'
            + '<span> Status (according to Navigator): </span><span style="font-weight: 700; color:' + newColor + '">' + c.statusnavigator + '</span><br>'
            + '<span> Status (according to report): </span><span style="font-weight: 700">' + c.status + '</span><br>'
            + 'Start: ' + start + '<br>'
            + 'End (estimated): ' + end + '<br>'
            + 'Duration: ' + duration + ' days<br>'
            + 'Size (only complete contracts): ' + size + ' GB<br>'
            + 'Locked collateral: ' + c.locked + '<br>'
            + 'Risked collateral: ' + c.risked + '<br>'
            + 'Potential revenue: ' + c.revenue
            + '</div>';

    }


    // ADDRESSES BATCH SEARCH
    $("button[name = 'addressesBatch']").click(function(){
        // Hiding elements
        document.getElementById("header").style.display = 'none'; 
        document.getElementById("inset").style.display = 'none'
        document.getElementById("content").style.display = 'none'
        document.getElementById("content2").style.display = 'none'
        document.getElementById("content3").style.display = 'none'
        document.getElementById("content4").style.display = 'none'
        document.getElementById("content5").style.display = 'none'
        document.getElementById("content6").style.display = 'none'
        document.getElementById("loader").style.display = 'block'
        document.getElementById("loader2").style.display = 'block'
        document.getElementById("loader4").style.display = 'block'
        document.getElementById("statCardsContainer").style.display = 'none'
        document.getElementById("txListContainer").style.display = 'none'

        query = document.getElementById("addressesInput").value

        var pathPost = apiPath + "/addresses"
        $.post(pathPost,
        {
            query: query,
        },
        function(data,status){

            renderWalletSummary(data)

            renderWalletAddresses(data)

            // Box for requesting to download a CSV of the transactions
            var addresses = query.replace(/\n/g, ',');
            var addressesArray = addresses.split(",");
            
            if (useCoinGeckoPrices == true) {
                renderCsvDownloadBox(addressesArray, "content5")
            }
            
            renderWalletTxs(data)

            document.getElementById("loader").style.display = 'none'
            document.getElementById("loader3").style.display = 'none'
            document.getElementById("loader4").style.display = 'none'
            adjustWidth()
        });
    });

    function renderWalletSummary(data) {
        // Renders the balance table of the batch of wallets
        var tableCode = '<div class="home-outer" style="height:225px">'
            + '<div class="home-inner table-address" style="padding: 0px 25px; width: 700px; height:225px">'
                + '<div class="home-element">'
                    + '<table id="table-fill" class="table-outer" style="margin: 0px">'
                        + '<thead>'
                            + '<tr style="height: 25px">'
                                + '<th colspan="2" class="text-left">'
                                    + '<span style="vertical-align:center; margin: 0px 0px 0px 5px"><strong><font size="3">Wallet summary:</font></strong></span>'
                                + '</th>'
                            + '</tr>'
                            + '<tr>'
                                + '<td style="height: 60px; padding: 0px 15px; font-size:110%; vertical-align:center;">Confirmed Siacoin balance: </td>'
                                + '<td style="height: 60px; padding: 0px 15px; font-size:110%; vertical-align:center; text-align: right">' + readable(data[0].balanceSc) + ' SC'
                                    + '<br><span style="font-size: 12px">' + readable(data[0].receivedSc) + ' SC received / -' + readable(data[0].sentSc) + ' SC sent</span>'
                                + '</td>'
                            + '</tr>'
                            + '<tr>'
                                + '<td style="height: 45px; padding: 0px 15px; font-size:110%; vertical-align:center;">Confirmed Siafund balance: </td>'
                                + '<td style="height: 45px; padding: 0px 15px; font-size:110%; vertical-align:center; text-align: right">' + data[0].balanceSf + ' SF</td>'
                            + '</tr>'
                            + '<tr>'
                                + '<td style="height: 45px; padding: 0px 15px; font-size:110%; vertical-align:center;">Number of transactions: </td>'
                                + '<td style="height: 45px; padding: 0px 15px; font-size:120%; vertical-align:center; text-align: right">' + data[0].TotalTxCount + '</td>'
                            + '</tr>'
                        + '</thead>'
                    + '</table>'
                + '</div>'
            + '</div>'
            + '<div class="home-inner qr-code" style="height:175px; padding: 0px 0px 75px 25px; width: 400px">'
                + '<div id="card" style="height:175px; text-align: center; padding: 15 0 0 0">'
                    + '<svg style=""><use xlink:href="#wallet-big" class="icon-decoration"/></svg>'
                + '</div>'
            + '</div>'
        + '</div>'
        + '<div class="disclaimer">'
            + '<span style=""><i>The information shown is orientative and should not be considered more reliable than the information provided by the wallet UI. Bugs in Navigator or an out-of-date list of addresses could provoke a few transactions to be missing and affect the shown balance.'
            + '<a href="about" style="display:block; color:inherit; text-decoration: underline;">Check About for contact info</a></i></span></div>'
                
        document.getElementById('content5').innerHTML = tableCode
        document.getElementById("content5").style.display = 'block'  
    }

    function renderWalletAddresses(data) {
        // Shows the list of changes in balance for a particular address

        var addresses = data[1].addresses
        // Only addresses with positive balance
        var positiveAddresses = []
        for (var i = 0; i < addresses.length; i++) {
            if (addresses[i].sc > 0 || addresses[i].sf > 0) {
                positiveAddresses.push(addresses[i])
            }
        }

        var div = document.createElement('div');
        div.className = 'row';
        var tableCode = '<table id="table-fill" class="table-outer" style="width: 1150px">' 
            + '<thead>'
                + '<tr>'
                    + '<th colspan="2" class="text-left">'
                        + '<span style="vertical-align:center; margin: 0px 0px 0px 5px"><strong><font size="3">Addresses with positive balance:</font></strong></span>'
                    + '</th>'
                + '</tr>'
        for (var n = 0; n < positiveAddresses.length; n++) {
            var value = positiveAddresses[n].sc
            if (value < 0) {value = 0} // This avoids artifacts like "-0.000"

            tableCode = tableCode + '<tr style="height: 40px">'
                    + '<td style="font-size:small; border-right: 0px"><a href=' + htmlPath + '?search=' + positiveAddresses[n].address + '>'
                        + shortHash(positiveAddresses[n].address) + '</a></td>'
                    + '<td style="border-right: 0px; font-weight: 700; font-size:90%; text-align: right">' 
                        + readable(value) + ' SC / ' + positiveAddresses[n].sf + ' SF</td>'
                + '</tr>'
        }
                
        // This closes the table
        tableCode = tableCode + '</thead> </table>'
        div.innerHTML = tableCode
        document.getElementById('content5').appendChild(div);
    }

    function renderWalletTxs(data) {
        // Shows merged transactions of the addresses
        var txs = data[2].last100Transactions
        txs.sort(function(a, b) {
            return parseFloat(b.Height) - parseFloat(a.Height);
        })
        var path = apiPath + "/status"
        $.getJSON(path, function(auxblock) { // Loads auxblock

            var container = "content6"
            renderAddressList(txs, auxblock, container, null)
            
        })
    }


    // HASH SEARCH
    var path = apiPath + "/status"
    $.getJSON(path, function(auxblock) {
        
        var qs = window.location.search
        searchQuery = qs.slice(8)
        if (searchQuery.length == 64 || searchQuery.length == 76 || parseInt(searchQuery) >= 0) { // It is a valid hash
            var jsonPath = apiPath + '/hash/' + searchQuery
            $.getJSON(jsonPath, function(data) {
                
                // Hiding loader
                document.getElementById("loader").style.display = 'none';
                document.getElementById("loader3").style.display = 'none';
                
                if (data != "") { // The api returned something different than an empty array
                    // 1 - The first thing to show is the hash type header
                    document.getElementById("header").style.display = 'block'; 
                    document.getElementById("inset").style.display = 'block'
                    var hashType = renderHeader(data, searchQuery)

                    // 2 - Unless it is a block, or an address, the next element is the transaction scheme 
                    if (data[0].Type == "block") {
                        // Metadata of the block
                        var miner = data[1].MiningPool
                        renderBlockHTML(data, miner)

                        // List of transactions
                        renderTxInBlock(data)

                    } else if (data[0].Type == "address") {
                        // QR code of the address and sumary table
                        renderQrAndBalance(data, searchQuery)

                        // Box for requesting to download a CSV of the transactions
                        if (useCoinGeckoPrices == true) {
                            renderCsvDownloadBox([searchQuery], "content")
                        }
                        
                        // List of transactions
                        var txs = data[1].last100Transactions
                        var container = 'content2'
                        renderAddressList(txs, auxblock, container, data[1].unconfirmedTransactions)
                        renderOutputsList(txs, auxblock, searchQuery)

                        adjustWidth()

                    } else if (data[0].Type == "unconfirmed") {
                        renderUnconfirmed()

                    } else if (data[0].Type == "output") {
                        // Transaction metadata table
                        renderOutputTable(data)

                    } else {
                        
                        // Scheme of the transaction
                        renderScheme(data)

                        // Transaction metadata table
                        renderTxTable(data, hashType)

                        // In case of file contract render 2 extra elements: related operations and timeline graph
                        if (data[0].Type == "contract") {
                            renderContractRelated(data)
                            renderContractTimeline(data)
                        }
                        // Readjsut the widths of all the elements
                        adjustWidth()
                        
                    }
                    
                    //Hidding elements after loading
                    document.getElementById("loader2").style.display = 'none';
                    
                    
                } else {
                    // Error: hash not found
                    renderError(searchQuery)
                }

            });

        } else if (searchQuery.length == 0 ) { // Default screen, with last blocks and last TX tables, a chart...
            var path = apiPath + "/landing"
            $.getJSON(path, function(landing) { // Loading data
                renderLandingPage(auxblock, landing)
                
                // Hiding elements
                document.getElementById("loader").style.display = 'none';
                document.getElementById("loader2").style.display = 'none';
                document.getElementById("loader3").style.display = 'none';

                // Readjsut the widths of all the elements
                adjustWidth()
            })

        } else { // Invalid search
            document.getElementById("loader").style.display = 'none';
            document.getElementById("loader3").style.display = 'none';
            document.getElementById("result").innerHTML = "Invalid search"

        }
        
        function renderUnconfirmed() {
            // Renders Unconfirmed message
            document.getElementById("inset").style.display = 'none'

            var now = new Date()
            var hour = now.getHours();
            if (hour < 10) {hour = "0" + hour}
            var min = now.getMinutes();
            if (min < 10) {min = "0" + min}
            var sec = now.getSeconds();
            if (sec < 10) {sec = "0" + sec}
            var time = hour + ':' + min + ':' + sec 

            var div = document.createElement('div');
            div.className = 'row';
            var tableCode = '<div style="height: 100px"></div>'
                    + '<div style="width: 600px; margin: 0px auto; padding: 0px 25px">'
                        + '<div style="width: 106px; color:' + theme.decoration + '; float: left;">'
                            + '<svg style="width: 106; height: 150"><use xlink:href="#unconfirmed-decoration" class="icon-decoration"/></svg></div>'
                        + '<div style="width: 480px; color: ' + theme.decoration + '; text-align: left; float: right">'
                            + '<span style="font-size: 40px">Unconfirmed transaction<br></span>'
                            + '<span style="font-size: 20px">The transaction was broadcasted to the network and it is waiting to be included in a block.<br></span>'
                            + '<span style="font-size: 20px">This page will refresh every minute and show the full TX information once confirmed. Last check: ' + time + '.</span>'
                        + '</div>'
                    + '</div>'
                + '<div style="height: 400px"></div>'
            div.innerHTML = tableCode
            document.getElementById('content').appendChild(div);

            // Reloads the page after 1 minute
            setTimeout(function(){
                location.reload()
            }, 60000);
        }


        // Renders the home page contents
        function renderLandingPage(status, landing) {
            // Stat cards rendering
            document.getElementById("statCardsContainer").style.display = 'block'
            document.getElementById("txListContainer").style.display = 'block'
            document.getElementById("statCard1").innerHTML = status[0].consensusblock
            if (status[0].lastblock >= 0) {
                document.getElementById("statCard2").innerHTML = status[0].lastblock
            } else {
                document.getElementById("statCard2").innerHTML = "..."
            }
            document.getElementById("statCard3").innerHTML = status[0].peers
            document.getElementById("statCard4").innerHTML = status[0].mempool
            document.getElementById("statCard5").innerHTML = metric(status[0].totalTx)
            document.getElementById("statCard6").innerHTML = status[0].version
            // If syncing, show a yellow spinner
            if (status[0].lastblock < status[0].consensusblock) {
                document.getElementById("syncSpinner").innerHTML = "<i class='fa fa-refresh fa-spin' style='color: " 
                    + theme.yellow + "' ></i>"
            }

            if (landing.last10Blocks != null) {
                // Last 10 blocks table
                for (var i = 0; i < landing.last10Blocks.length; i++) {
                    var link = '<a href=' + htmlPath + '?search=' + landing.last10Blocks[i].Height + ' style="display:block; color:' + theme.text + '">'
                    document.getElementById("landingTable1-"+i+"a").innerHTML = link 
                        + '<svg style="width: 20px; height: 20px; padding: 3px 10px 2px 0px; vertical-align:middle"><use xlink:href="#block" class="icon-text"/></svg>'
                        + '<span style="vertical-align:middle">' + landing.last10Blocks[i].Height + "</span></a>"
                    document.getElementById("landingTable1-"+i+"b").innerHTML = link + landing.last10Blocks[i].MiningPool + "</a>"
                    document.getElementById("landingTable1-"+i+"c").innerHTML = link + blocksTime(landing.last10Blocks[i].Timestamp) + "</a>"
                }

                // Last 10 SC Tx
                for (var i = 0; i < landing.last10ScTx.length; i++) {
                    var link = '<a href=' + htmlPath + '?search=' + landing.last10ScTx[i].TxHash + ' style="display:block; color:' + theme.text + '">'
                    document.getElementById("landingTable2-"+i+"a").innerHTML = '<svg style="width: 25px; height: 25px"><use xlink:href="#sctx-text" class="icon-text"/></svg>'
                    document.getElementById("landingTable2-"+i+"b").innerHTML = link + "SC Tx" + "</a>"
                    document.getElementById("landingTable2-"+i+"c").innerHTML = link + "<code>" + miniHash(landing.last10ScTx[i].TxHash) + "</code></a>"
                }

                // Last 10 contract activity
                for (var i = 0; i < landing.last10Contracts.length; i++) {
                    var link = '<a href=' + htmlPath + '?search=' + landing.last10Contracts[i].TxHash + ' style="display:block; color:' + theme.text + '">'
                    document.getElementById("landingTable3-"+i+"a").innerHTML = '<svg style="width: 25px; height: 25px"><use xlink:href="#' 
                        + landing.last10Contracts[i].TxType + '-text" class="icon-text"/></svg>'
                    document.getElementById("landingTable3-"+i+"b").innerHTML = link + prettyTxType(landing.last10Contracts[i].TxType) + "</a>"
                    document.getElementById("landingTable3-"+i+"c").innerHTML = link + "<code>" + miniHash(landing.last10Contracts[i].TxHash) + "</code></a>"
                }

                // Last 10 others
                for (var i = 0; i < landing.last10Others.length; i++) {
                    var link = '<a href=' + htmlPath + '?search=' + landing.last10Others[i].TxHash + ' style="display:block; color:' + theme.text + '">'
                    document.getElementById("landingTable4-"+i+"b").innerHTML = link + prettyTxType(landing.last10Others[i].TxType) + "</a>"
                    if (landing.last10Others[i].TxType == "host ann") {landing.last10Others[i].TxType = "hostann"}
                    if (landing.last10Others[i].TxType == "blockreward") {landing.last10Others[i].TxType = "miner"}
                    if (landing.last10Others[i].TxType == "SfTx") {landing.last10Others[i].TxType = "sftx"}
                    document.getElementById("landingTable4-"+i+"a").innerHTML = '<svg style="width: 25px; height: 25px"><use xlink:href="#' 
                        + landing.last10Others[i].TxType + '-text" class="icon-text"/></svg>'
                    document.getElementById("landingTable4-"+i+"c").innerHTML = link + "<code>" + miniHash(landing.last10Others[i].TxHash) + "</code></a>"
                }
            }
            
            adjustWidth()
            refreshLanding(status[0].lastblock, status[0].consensusblock, status[0].mempool, landing)
        }

        function refreshLanding(lastBlock, consensusBlock, prevMempool, landing) {
            // Every 15 seconds updates the info of the status file. If a new block was indexed, the whole landing screen is refreshed
            // This works as a recursive function
            setTimeout(function(){
                // Only if we are not on a different tab
                if (document.getElementById("statCardsContainer").style.display != "none") {

                    // Update timestamp of blocks
                    for (var i = 0; i < landing.last10Blocks.length; i++) {
                        var link = '<a href=' + htmlPath + '?search=' + landing.last10Blocks[i].Height + ' style="display:block; color:' + theme.text + '">'
                        document.getElementById("landingTable1-"+i+"c").innerHTML = link + blocksTime(landing.last10Blocks[i].Timestamp) + "</a>"
                    }
                    
                    $.getJSON(apiPath + "/status", function(status) {
                        if (status[0].lastblock == undefined) {
                            // Error on API. Try again in 3 seconds
                            setTimeout(function(){
                                refreshLanding(lastBlock, consensusBlock, prevMempool, landing)
                            }, 3000)

                        } else {
                            // Animations
                            if (status[0].mempool != prevMempool) {
                                $("#mempoolCardHighlight").fadeIn(500).fadeOut(500)
                                var animationDuration = 1000 / (status[0].mempool - 0)
                                animateNumber(document.getElementById("statCard4"), prevMempool, status[0].mempool, animationDuration);
                            }
                            if (status[0].consensusblock != consensusBlock) {
                                $("#heightCardHighlight").fadeIn(500).fadeOut(500)
                            }
                            
                            
                            // Check if a new block was added. Reload
                            if (status[0].lastblock != lastBlock) {
                                $.getJSON(apiPath + "/landing", function(landing) {
                                    // Animations
                                    $("#syncedCardHighlight").fadeIn(500).fadeOut(500)
                                    var animationDuration = 1000 / (status[0].lastblock - lastBlock)
                                    if (status[0].lastblock >= 0) {
                                        if (lastBlock == undefined) {lastBlock = status[0].lastblock - 1} // In case of bugged initial file
                                        animateNumber(document.getElementById("statCard2"), lastBlock, status[0].lastblock, animationDuration);
                                        
                                        if (status[0].lastblock < status[0].consensusblock) {
                                            document.getElementById("syncSpinner").innerHTML = "<i class='fa fa-refresh fa-spin' style='color: " 
                                                + theme.yellow + "' ></i>"
                                        } else {
                                            document.getElementById("syncSpinner").innerHTML = "<i class='fa fa-refresh' style='color: " 
                                                + theme.accent + "' ></i>"
                                        }
                                    }                             
                                    
                                    // Update the rest after 1 second timeout to complete the animations
                                    setTimeout(function(){
                                        renderLandingPage(status, landing)
                                    }, 1000)
                                })
                            } else {
                                // Next recursion
                                refreshLanding(lastBlock, status[0].consensusblock, status[0].mempool, landing)
                            }
                        }
                    })
                }
            }, landingRefreshPeriod)
        }

        function animateNumber(elem, from, to, duration) {    
            // Animates a number change
            var interval = setInterval(function(){
                if (from >= to) clearInterval(interval);        
                elem.innerText = from++;  
            }, duration);
        }         

        function metric(num) {
            // Prettifies a big number
            if (num >= 1000000) {
                num = (num / 1000000).toFixed(2) + " M"
            }
            return num
        }

        function blocksTime(timestamp) {
            var now = Date.now()
            var date = new Date(timestamp * 1000)
            var difference = ((now - date) / 1000).toFixed(0)
            var diffhour = Math.floor(difference/3600)
            var diffmin = Math.floor((difference - (diffhour * 3600))/60)
            var diffsec = difference - (diffhour * 3600) - (diffmin * 60)
            if (diffmin < 10) {diffmin = "0" + diffmin}
            if (diffsec < 10) {diffsec = "0" + diffsec}
            var tabletime = diffhour + "h " + diffmin + "m " + diffsec + "s ago"
            return tabletime
        }

        function prettyTxType(type) {
            if (type == "host ann") {var newType = "Host announcement"}
            else if (type == "blockreward") {var newType = "Block reward"}
            else if (type == "SfTx") {var newType = "SF Tx"}
            else if (type == "contract") {var newType = "Formation"}
            else if (type == "contractresol") {var newType = "Resolution"}
            else if (type == "revision") {var newType = "Revision"}
            else if (type == "storageproof") {var newType = "Storage proof"}
            return newType
        }

        function miniHash(hash) {
            var shortHash = hash.slice(0,40) + "..."
            return shortHash
        }

        
        function renderHeader(data, searchQuery) {
            // Translating the hash types to legible and rendering the header
            var hashType
            if (data[0].Type == "ScTx") {
                hashType = "Siacoin transaction"
                document.getElementById('header-icon').innerHTML = '<use xlink:href="#sctx-contrast" class="icon-contrast"/>'}
            else if (data[0].Type == "SfTx") {
                hashType = "Siafund transaction"
                document.getElementById('header-icon').innerHTML = '<use xlink:href="#sftx-contrast" class="icon-contrast"/>'}
            else if (data[0].Type == "storageproof") {
                hashType = "Storage Proof"
                document.getElementById('header-icon').innerHTML = '<use xlink:href="#storageproof-contrast" class="icon-contrast"/>'}
            else if (data[0].Type == "blockreward") {
                hashType = "Block reward"
                document.getElementById('header-icon').innerHTML = '<use xlink:href="#miner-contrast" class="icon-contrast"/>'}
            else if (data[0].Type == "block") {
                hashType = "Block"
                if (searchQuery.length < 7) { // If searched item is a block height, use a bigger font size
                    document.getElementById("header3").style.fontSize = "26px";
                }
                document.getElementById('header-icon').innerHTML = '<use xlink:href="#block" class="icon-contrast"/>'}
            else if (data[0].Type == "allowancePost") {
                hashType = "Allowance posting"
                document.getElementById('header-icon').innerHTML = '<use xlink:href="#allowance-contrast" class="icon-contrast"/>'}
            else if (data[0].Type == "collateralPost") {
                hashType = "Collateral posting"
                document.getElementById('header-icon').innerHTML = '<use xlink:href="#collateral-contrast" class="icon-contrast"/>'}
            else if (data[0].Type == "address") {
                hashType = "Address"
                document.getElementById("header3").style.fontSize = "15px"
                document.getElementById('header-icon').innerHTML = '<use xlink:href="#address-contrast" class="icon-contrast"/>'}
            else if (data[0].Type == "contractresol") {
                hashType = "Contract resolution"
                document.getElementById('header-icon').innerHTML = '<use xlink:href="#resolution-contrast" class="icon-contrast"/>'}
            else if (data[0].Type == "revision") {
                hashType = "Contract revision"
                document.getElementById('header-icon').innerHTML = '<use xlink:href="#revision-contrast" class="icon-contrast"/>'}
            else if (data[0].Type == "contract") {
                hashType = "File Contract formation"
                document.getElementById('header-icon').innerHTML = '<use xlink:href="#contract-contrast" class="icon-contrast"/>'}
            else if (data[0].Type == "host ann") {
                hashType = "Host announcement"
                document.getElementById('header-icon').innerHTML = '<use xlink:href="#hostann-contrast" class="icon-contrast"/>'}
            else if (data[0].Type == "unconfirmed") {
                hashType = "Unconfirmed transaction"
                document.getElementById('header-icon').innerHTML = '<use xlink:href="#unconfirmed-contrast" class="icon-contrast"/>'}
            else if (data[0].Type == "output") {
                hashType = "Transaction output"
                document.getElementById('header-icon').innerHTML = '<use xlink:href="#output" class="icon-contrast"/>'
            }
            
            document.getElementById("header2").innerHTML = hashType
            document.getElementById("header3").innerHTML = shortHash(searchQuery)

            // Confirmations of the TX, unless the hash is an address
            if (data[0].Type == "unconfirmed") {
                document.getElementById("header4").innerHTML = "Unconfirmed"
                document.getElementById("header5").style.backgroundColor = theme.red
                document.getElementById("header6").style.backgroundColor = theme.red
            } else if (data[0].Type != "address") {
                if (data[0].Type == "output") {
                    var confirmationsNum = auxblock[0].consensusblock - data[1].CreatedOnBlock + 1
                } else {
                    var confirmationsNum = auxblock[0].consensusblock - data[1].Height + 1
                }
                
                
                if (confirmationsNum > 72) {confirmationsNum = "72+"}
                document.getElementById("header4").innerHTML = confirmationsNum + " confirmations"
                if (confirmationsNum >= 10 && confirmationsNum < 72) {
                    document.getElementById("header5").style.backgroundColor = theme.lime
                    document.getElementById("header6").style.backgroundColor = theme.lime
                } else if (confirmationsNum < 10) {
                    document.getElementById("header5").style.backgroundColor = theme.yellow
                    document.getElementById("header6").style.backgroundColor = theme.yellow
                } else {
                    document.getElementById("header5").style.backgroundColor = theme.accent
                    document.getElementById("header6").style.backgroundColor = theme.accent
                }
            }

            return hashType // This will help with the TX table
        }

        function renderScheme(data) {
            // This assembles the Scheme: a transaction representation with inputs at the left and outputs at the right, connected with an arrow
            // Boolean to identify the first receiver:
            firstReceiverBool = true

            // SENDERS
            if (data[0].Type != "contract") {
                for (var n = 0; n < data[2].transactions.length; n++) {
                    // Address
                    var addressInBox = shortHash(data[2].transactions[n].Address)
                    // Link
                    var linkInBox = htmlPath + "?search=" + data[2].transactions[n].Address
                    // Color of value change. By default red, in SF orange
                    var colorInBox = theme.brightRed
                    
                    // Identifying senders
                    if (data[2].transactions[n].ScChange < 0 || data[2].transactions[n].SfChange < 0) {
                        
                        if (data[2].transactions[n].ScChange < 0) {
                            var valueInBox = data[2].transactions[n].ScChange // Push the change in SC
                            valueInBox = readable(valueInBox) + " SC"
                        } else if (data[2].transactions[n].SfChange < 0) {
                            var valueInBox = data[2].transactions[n].SfChange + " SF" // Push the change in SF
                        }
                        
                        // Naming the sending object
                        if (data[0].Type == "ScTx" || data[0].Type == "SfTx") {var objectInBox = "Sender address"}
                        else if (data[0].Type == "host ann") {var objectInBox = "Host address"}
                        else if (data[0].Type == "allowancePost") {var objectInBox = "Renter address"}
                        else if (data[0].Type == "collateralPost" || data[0].Type == "storageproof") {var objectInBox = "Host address"}
                        else if (data[0].Type == "revision") {var objectInBox = "Address"}

                        // Color
                        if (data[0].Type == "SfTx" && data[2].transactions[n].SfChange < 0) {colorInBox = "orange"}

                        // Image
                        if (data[0].Type == "ScTx" || data[0].Type == "SfTx" || data[0].Type == "revision") {var iconInBox = "address"}
                        else if (data[0].Type == "host ann") {iconInBox = "hostann"}
                        else if (data[0].Type == "allowancePost") {iconInBox = "renter"}
                        else if (data[0].Type == "collateralPost" || data[0].Type == "storageproof") {iconInBox = "host"}

                        // Pushing the Box to the Scheme
                        addRowSender(objectInBox, linkInBox, addressInBox, valueInBox, iconInBox, colorInBox)

                    }
                } 
            } 

            // Special cases
            if (data[0].Type == "contractresol") {
                var objectInBox = "File Contract ID"
                var colorInBox = theme.text
                var iconInBox = "contract"
                var contractInBox = shortHash(data[1].ContractId)
                var linkInBox = htmlPath + "?search=" + data[1].ContractId
                var valueInBox = readable(data[1].Output0Value + data[1].Output1Value + data[1].Output2Value) + " SC"
                addRowSender(objectInBox, linkInBox, contractInBox, valueInBox, iconInBox, colorInBox)
            }

            if (data[0].Type == "contract") {
                var objectInBox = "Renter: allowance posting hash"
                var colorInBox = theme.brightRed
                var iconInBox = "allowance"
                var addressInBox = shortHash(data[1].AllowancePosting)
                var linkInBox = htmlPath + "?search=" + data[1].AllowancePosting
                var valueInBox = "- " + readable(data[1].RenterValue) + " SC"
                addRowSender(objectInBox, linkInBox, addressInBox, valueInBox, iconInBox, colorInBox)
                
                var objectInBox2 = "Host: collateral posting hash"
                var iconInBox2 = "collateral"
                var addressInBox2 = shortHash(data[1].CollateralPosting)
                var linkInBox2 = htmlPath + "?search=" + data[1].CollateralPosting
                var valueInBox2 = "- " + readable(data[1].HostValue) + " SC"
                addRowSender(objectInBox2, linkInBox2, addressInBox2, valueInBox2, iconInBox2, colorInBox)
            }

            // Small boxes with only 2 rows for special TX types (block reward...)
            if (data[0].Type == "blockreward") {
                var objectInBox = "Coinbase"
                var colorInBox = theme.text
                var iconInBox = "network"
                var linkInBox = ""
                var sizeInBox = 4
                var subsidy =  300000 - data[1].Height
                if (subsidy < 30000) {subsidy = 30000} // Minimal future subsidy
                subsidyReadable = readable(subsidy * 1000000000000000000000000) + " SC"
                addSimpleSenderBox(objectInBox, subsidyReadable, colorInBox, iconInBox, linkInBox, sizeInBox)
                
                var minedFees = readable(data[2].transactions[0].ScChange - (subsidy * 1000000000000000000000000)) + " SC"
                var objectInBox = "Collected transaction fees"
                addSimpleSenderBox(objectInBox, minedFees, colorInBox, iconInBox, linkInBox, sizeInBox)
            }

            // RECEIVERS
            if (data[0].Type != "contractresol" && data[0].Type != "contract") { // Resolutions and contracts are treated differently
                for (var n = 0; n < data[2].transactions.length; n++) {
                    // Address
                    var addressInBox = shortHash(data[2].transactions[n].Address)
                    // Link
                    var linkInBox = htmlPath + "?search=" + data[2].transactions[n].Address
                    // Color of value change. By default green, in SF purple
                    var colorInBox = theme.darkGreen

                    // In contracts, instead of the destination address I show the final contract ID
                    if ((data[0].Type == "allowancePost" || data[0].Type == "collateralPost") && data[2].transactions[n].TxType == "contractform") {
                        var addressInBox = shortHash(data[1].HashSynonyms)
                        var linkInBox = htmlPath + "?search=" +data[1].HashSynonyms
                    }
                    
                    // Identifying receivers
                    if (data[2].transactions[n].ScChange > 0 || data[2].transactions[n].SfChange > 0) {
                        if (data[2].transactions[n].ScChange > 0) {
                            var valueInBox = data[2].transactions[n].ScChange // Push the change in SC
                            valueInBox = readable(valueInBox) + " SC"
                        } else if (data[2].transactions[n].SfChange > 0) {
                            var valueInBox = data[2].transactions[n].SfChange + " SF" // Push the change in SF
                        }

                        // Naming the receiving object
                        if (data[0].Type == "ScTx") {var objectInBox = "Receiver address"}
                        else if (data[0].Type == "SfTx" && data[2].transactions[n].TxType != "SfClaim" && data[2].transactions[n].SfChange > 0) {var objectInBox = "Receiver address"}
                        else if (data[0].Type == "SfTx" && data[2].transactions[n].TxType != "SfClaim" && data[2].transactions[n].ScChange > 0) {var objectInBox = "Sender wallet return (unspent output)"}
                        else if (data[0].Type == "SfTx" && data[2].transactions[n].TxType == "SfClaim") {var objectInBox = "SiaFund dividend claim address (sender)"}
                        else if (data[0].Type == "host ann") {var objectInBox = "Host address"}
                        else if (data[0].Type == "allowancePost" && data[2].transactions[n].TxType != "contractform") {var objectInBox = "Renter address"}
                        else if (data[0].Type == "allowancePost" && data[2].transactions[n].TxType == "contractform") {var objectInBox = "Allowance for Contract ID"}
                        else if (data[0].Type == "collateralPost" && data[2].transactions[n].TxType != "contractform") {var objectInBox = "Host address"}
                        else if (data[0].Type == "collateralPost" && data[2].transactions[n].TxType == "contractform") {var objectInBox = "Collateral for Contract ID"}
                        else if (data[0].Type == "storageproof") {var objectInBox = "Host address"}
                        else if (data[0].Type == "blockreward") {var objectInBox = "Miner payout address"}
                        else if (data[0].Type == "revision") {var objectInBox = "Address (same wallet)"}

                        // Color
                        if (data[0].Type == "SfTx" && data[2].transactions[n].SfChange > 0) {colorInBox = "purple"}

                        // Image
                        if (data[0].Type == "ScTx" || data[0].Type == "revision" || (data[0].Type == "SfTx" && data[2].transactions[n].TxType != "SfClaim")) {iconInBox = "address"}
                        else if (data[0].Type == "ScTx" || (data[0].Type == "SfTx" && data[2].transactions[n].TxType == "SfClaim")) {var iconInBox = "sfclaim"}
                        else if (data[0].Type == "host ann") {iconInBox = "host"}
                        else if (data[0].Type == "allowancePost" && data[2].transactions[n].TxType != "contractform") {iconInBox = "renter"}
                        else if (data[0].Type == "allowancePost" && data[2].transactions[n].TxType == "contractform") {iconInBox = "contract"}
                        else if (data[0].Type == "collateralPost" && data[2].transactions[n].TxType != "contractform") {iconInBox = "host"}
                        else if (data[0].Type == "collateralPost" && data[2].transactions[n].TxType == "contractform") {iconInBox = "contract"}
                        else if (data[0].Type == "storageproof") {iconInBox = "host"}
                        else if (data[0].Type == "blockreward") {iconInBox = "miner"}

                        // Pushing the Box to the Scheme
                        addRowReceiver(objectInBox, linkInBox, addressInBox, valueInBox, iconInBox, firstReceiverBool, colorInBox)

                        // Checking if this is the first receiver: if yes, change the boolean 
                        if (firstReceiverBool == true) {firstReceiverBool = false}
                    }
                }
            }

            // Extra Boxes for certain transaction types
            if (data[0].Type == "host ann") {
                var objectInBox = "New host announced: IP"
                var colorInBox = theme.text
                var iconInBox = "hostann"
                var linkInBox = ""
                var sizeInBox = 4
                addSimpleBox(objectInBox, data[1].IP, colorInBox, iconInBox, linkInBox, sizeInBox, firstReceiverBool)
                firstReceiverBool = false
            
            } else if (data[0].Type == "storageproof") {
                var objectInBox = "Submits a proof for Contract ID"
                var colorInBox = theme.text
                var iconInBox = "storageproof"
                var resolutionId = shortHash(data[1].ContractId)
                var linkInBox = htmlPath + "?search=" + (data[1].ContractId)
                var sizeInBox = 2
                addSimpleBox(objectInBox, resolutionId, colorInBox, iconInBox, linkInBox, sizeInBox, firstReceiverBool)
                firstReceiverBool = false

            } else if (data[0].Type == "revision") {
                var objectInBox = "Revision of Contract ID"
                var colorInBox = theme.text
                var iconInBox = "revision"
                var contractId = shortHash(data[1].ContractId)
                var linkInBox = htmlPath + "?search=" + data[1].ContractId
                var sizeInBox = 2
                addSimpleBox(objectInBox, contractId, colorInBox, iconInBox, linkInBox, sizeInBox, firstReceiverBool)
                firstReceiverBool = false
            
            } else if (data[0].Type == "contractresol") {
                if (data[1].Result == "fail") {
                    var objectInBox = "Renter address: returned allowance"
                    var objectInBox2 = "Host address: unused collateral"
                } else {
                    var objectInBox = "Renter address: unused allowance"
                    var objectInBox2 = "Host address: payout + collateral back"
                }
                var colorInBox = theme.darkGreen
                var iconInBox = "renter"
                var addressInBox = shortHash(data[1].Output0Address)
                var linkInBox = htmlPath + "?search=" + data[1].Output0Address
                var valueInBox = readable(data[1].Output0Value) + " SC"
                var firstReceiverBool = true
                addRowReceiver(objectInBox, linkInBox, addressInBox, valueInBox, iconInBox, firstReceiverBool, colorInBox)
                var addressInBox2 = shortHash(data[1].Output1Address)
                var valueInBox2 = readable(data[1].Output1Value) + " SC"
                var linkInBox2 = htmlPath + "?search=" + data[1].Output1Address
                var iconInBox2 = "host"
                var firstReceiverBool = false
                addRowReceiver(objectInBox2, linkInBox2, addressInBox2, valueInBox2, iconInBox2, firstReceiverBool, colorInBox)
                if (data[1].Result == "fail") {
                    var objectInBox3 = "Burning address: lost collateral"
                    var addressInBox3 = shortHash(data[1].Output2Address)
                    var valueInBox3 = readable(data[1].Output2Value) + " SC"
                    var linkInBox3 = htmlPath + "?search=" + data[1].Output2Address
                    var iconInBox3 = "burn"
                    var colorInBox = theme.brightRed
                    addRowReceiver(objectInBox3, linkInBox3, addressInBox3, valueInBox3, iconInBox3, firstReceiverBool, colorInBox)
                }
            } else if (data[0].Type == "contract") {
                var objectInBox = "Formed Contract ID"
                var addressInBox = shortHash(data[1].ContractId)
                var totalSc = data[1].ValidProof1Value + data[1].ValidProof2Value
                var valueInBox = readable(totalSc) + " SC"
                var linkInBox = htmlPath + "?search=" + data[1].ContractId
                var iconInBox = "contract"
                var colorInBox = theme.darkGreen
                var firstReceiverBool = true
                addRowReceiver(objectInBox, linkInBox, addressInBox, valueInBox, iconInBox, firstReceiverBool, colorInBox)

                // Exceptional contracts where some amount returns to the renter address in the contract formation
                if (data[5].transactions.length > 0) {
                    for (var i = 0; i < data[5].transactions.length; i++) {
                        var objectInBox = "Renter address"
                        var addressInBox = shortHash(data[5].transactions[i].Address)
                        var valueInBox = readable(data[5].transactions[i].ScChange) + " SC"
                        var linkInBox = htmlPath + "?search=" + data[5].transactions[i].Address
                        var iconInBox = "renter"
                        var colorInBox = theme.darkGreen
                        var firstReceiverBool = false
                        addRowReceiver(objectInBox, linkInBox, addressInBox, valueInBox, iconInBox, firstReceiverBool, colorInBox)
                    }
                }  

                // SiaFund fees
                var objectInBox = "Fees paid to SF holders"
                var valueInBox = readable(data[1].SfFees) + " SC"
                var linkInBox = ""
                var iconInBox = "sfclaim"
                var colorInBox = theme.darkGreen
                var sizeInBox = 4
                addSimpleBox(objectInBox, valueInBox, colorInBox, iconInBox, linkInBox, sizeInBox)
            }
            
            // Miner fees. Not if it is a collateral post or an allowance post
            if (data[0].Type != "allowancePost" && data[0].Type != "collateralPost" && data[0].Type != "contractresol" && data[0].Type != "blockreward") {
                var readableFees = readable(data[1].Fees) + " SC"
                var objectInBox = "Miner fees"
                var colorInBox = theme.darkGreen
                var iconInBox = "miner"
                var linkInBox = ""
                var sizeInBox = 4
                addSimpleBox(objectInBox, readableFees, colorInBox, iconInBox, linkInBox, sizeInBox)
            }

            // Adjusting the width of the elements
            adjustWidth()
        }

        function addRowSender(object, link, address, value, icon, color) {
            // Adds a sender to the Scheme
            var div = document.createElement('div');

            div.className = 'row';

            div.innerHTML =
                '<table id="scheme" class="table-outer scheme-outer" style="margin: 0px auto; padding: 0px auto; width: 1150px; text-align: left">'
                    + '<tr>'
                        + '<td class="address-box" style="background:inherit; height: 120px; width: 600px; padding: 0px">'
                            + '<table class="table-outer table-head-out" style="height: 80px;">'
                                + '<th style="width: 30px; text-align: center">'
                                    + '<svg style="width: 30px; height: 30px"><use xlink:href="#' + icon + '-contrast" class="icon-contrast"/></svg>'
                                + '</th>'
                                + '<th>'
                                    + '<table class="address-box-inner table-nav" style="width: 570px; height: 80px; background: ' + theme.boxHeaders + '; border-top-right-radius:10px; border-bottom-right-radius:10px">'
                                        + '<th class="text-left" style="height: 20px; border-bottom-left-radius:0px; border-top-left-radius:0px; border-bottom-right-radius:0px">'
                                            + '<span style="vertical-align:bottom; margin: 0px"><b>' + object +'</b></span>'
                                        + '</th>'
                                        + '<tr style="height: 30px; border-bottom-right-radius:10px;">'
                                            + '<td class="text-left" style="background: ' + theme.grey1 + '; border-radius: 0px; font-size: 12.5px">'
                                                + '<a href=' + link + '>' + address + '</a>'
                                            + '</td>'
                                        + '</tr>'
                                        + '<tr style="height: 30px">'
                                            + '<td class="text-right" style="text-align: right; padding: 0px 30px 0px 0px"><font size="4" color="' + color + '">' + value +'</font></td>'
                                        + '</tr>'
                                    + '</table>'
                                + '</th>'
                            + '</table>'
                        + '</td>'
                        + '<td style="background:inherit; height: 100px;">'
                        + '</td>'
                    + '</tr>'
                + '</table>'

            document.getElementById('content').appendChild(div);
        }

        function addRowReceiver(object, link, address, value, icon, bool, color) {
            // Adds a receiver to the Scheme
            var div = document.createElement('div');

            div.className = 'row';

            // Adds the arrow only in the first receiver
            if (bool == true) {
                var arrow =   '<td id="arrow" width=45px style="background:' + theme.background + '; padding: 0px; vertical-align: top; padding: 0px 0px 0px 40px">'
                                + '<div class="rectangle"></div>'
                            + '</td>'
                            + '<td class="arrow2" style="background:' + theme.background + '; padding: 40px 0px; min-width: 90px">'
                                + '<div style="height: 40px; background:' + theme.decorationSubtle + '; width: 100%;"></div>'
                            + '</td>'
                            + '<td width=30px style="background:' + theme.background + '; padding: 0px">'
                                + '<div class="triangle-right" style="padding: 0px 10px 0px 0px;"></div>'
                            + '</td>'
            } else {
                var arrow = '<td class="arrow2" style="background:' + theme.background + '; padding: 0px; min-width: 150px"></td>'
            }

            div.innerHTML =
                '<table id="scheme" class="table-outer scheme-outer" style="margin: 0px auto; padding: 0px auto; width: 1150px;>'
                    + '<tr>'
                        + '<td style="height: 120px; padding: 0px 0px 20px; background:#' + theme.background + ';">'
                            + arrow
                        + '</td>'
                        + '<td class="address-box" style="background:inherit; height: 120px; width: 600px; padding: 0px">'
                            + '<table class="table-outer table-head-out" style="height: 80px">'
                                + '<th style="width: 30px; text-align: center">'
                                    + '<svg style="width: 30px; height: 30px"><use xlink:href="#' + icon + '-contrast" class="icon-contrast"/></svg>'
                                + '</th>'
                                + '<th>'
                                    + '<table class="address-box-inner table-nav" style="width: 570px; height: 80px; background: ' + theme.black + '; border-top-right-radius:10px; border-bottom-right-radius:10px">'
                                        + '<th class="text-left" style="height: 20px; border-bottom-left-radius:0px; border-top-left-radius:0px; border-bottom-right-radius:0px">'
                                            + '<span style="vertical-align:bottom; margin: 0px"><b>' + object + '</b></span>'
                                        + '</th>'
                                        + '<tr style="height: 30px; border-bottom-right-radius:10px;">'
                                            + '<td class="text-left" style="background: ' + theme.grey1 + '; border-radius: 0px; font-size: 12.5px">'
                                                + '<a href=' + link + '>' + address + '</a>'
                                            + '</td>'
                                        + '</tr>'
                                        + '<tr style="height: 30px">'
                                            + '<td class="text-right" style="text-align: right; padding: 0px 30px 0px 0px"><font size="4" color=' + color + '>' + value + '</font></td>'
                                        + '</tr>'
                                    + '</table>'
                                + '</th>'
                            + '</table>'
                        + '</td>'
                    + '</tr>'
                + '</table>'

            document.getElementById('content').appendChild(div);
            if (arrow != null) {
                resizeArrow()
            }
        }

        function addSimpleBox (object, value, color, icon, link, size, bool) {
            // Adds a simple Box to the scheme (miner fees, host announced...)
            var div = document.createElement('div');

            if (link == "") {
                link2 = ""
            } else {
                link = '<a href=' + link + '>'
                link2 = "</a>"
            }
            if (value.length == 64) { value = shortHash(value)}

            div.className = 'row';

            // Adds the arrow only in the first receiver
            if (bool == true) {
                var arrow =   '<td id="arrow" width=45px style="background:' + theme.background + '; padding: 0px; vertical-align: top; padding: 0px 0px 0px 40px">'
                                + '<div class="rectangle"></div>'
                            + '</td>'
                            + '<td class="arrow2" style="background:' + theme.background + '; padding: 40px 0px; min-width: 90px">'
                                + '<div style="height: 40px; background:' + theme.decorationSubtle + '; width: 100%;"></div>'
                            + '</td>'
                            + '<td width=30px style="background:' + theme.background + '; padding: 0px">'
                                + '<div class="triangle-right" style="padding: 0px 10px 0px 0px;"></div>'
                            + '</td>'
            } else {
                var arrow = '<td class="arrow2" style="background:' + theme.background + '; padding: 0px; min-width: 150px"></td>'
            }

            div.innerHTML =
                '<table id="scheme" class="table-outer scheme-outer" style="margin: 0px auto; padding: 0px auto; width: 1150px; text-align: left">'
                    + '<tr>'
                        + '<td style="height: 120px; padding: 0px 0px 20px; background:' + theme.background + ';">'
                            + arrow
                        + '</td>'
                        + '<td class="address-box" style="background:' + theme.background + '; height: 90px; width: 600px; padding: 0px">'
                            + '<table class="table-outer table-head-out" style="height: 50px">'
                                + '<th style="width: 30px; text-align: center">'
                                    + '<svg style="width: 30px; height: 30px"><use xlink:href="#' + icon + '-contrast" class="icon-contrast"/></svg>'
                                + '</th>'
                                + '<th>'
                                    + '<table class="address-box-inner table-nav" style="width: 570px; height: 50px; background: ' + theme.black + '; border-top-right-radius:10px; border-bottom-right-radius:10px">'
                                        + '<th class="text-left" style="height: 20px; border-bottom-left-radius:0px; border-top-left-radius:0px; border-bottom-right-radius:0px">'
                                            + '<span style="vertical-align:bottom; margin: 0px"><b>' + object + '</b></span>'
                                        + '</th>'
                                        + '<tr style="height: 30px">'
                                            + '<td class="text-right" style="text-align: right; padding: 0px 30px 0px 0px">' + link
                                            + '<font size="' + size + '" color="' + color + '">' + value + '</font>' + link2 + '</td>'
                                        + '</tr>'
                                    + '</table>'
                                + '</th>'
                            + '</table>'
                        + '</td>'
                    + '</tr>'
                + '</table>'

            document.getElementById('content').appendChild(div);
            if (arrow != null) {
                resizeArrow()
            }
        }

        function addSimpleSenderBox (object, value, color, icon, link, size) {
            // Adds a simple Box to the scheme (block reward)
            var div = document.createElement('div');

            if (link == "") {
                link2 = ""
            } else {
                link = '<a href=' + link + '>'
                link2 = "</a>"
            }
            if (value.length == 64) { value = shortHash(value)}

            div.className = 'row';

            div.innerHTML =
            '<table id="scheme" class="table-outer scheme-outer" style="margin: 0px auto; padding: 0px auto; width: 1150px; text-align: left">'
                + '<tr>'
                    
                    + '<td class="address-box" style="background:inherit; height: 90px; width: 600px; padding: 0px">'
                        + '<table class="table-outer table-head-out" style="height: 50px">'
                            + '<th style="width: 30px; text-align: center">'
                                + '<svg style="width: 30px; height: 30px"><use xlink:href="#' + icon + '-contrast" class="icon-contrast"/></svg>'
                            + '</th>'
                            + '<th>'
                                + '<table class="address-box-inner table-nav" style="width: 570px; height: 50px; background: ' + theme.black + '; border-top-right-radius:10px; border-bottom-right-radius:10px">'
                                    + '<th class="text-left" style="height: 20px; border-bottom-left-radius:0px; border-top-left-radius:0px; border-bottom-right-radius:0px">'
                                        + '<span style="vertical-align:bottom; margin: 0px"><b>' + object + '</b></span>'
                                    + '</th>'
                                    + '<tr style="height: 30px">'
                                        + '<td class="text-right" style="text-align: right; padding: 0px 30px 0px 0px">' + link
                                        + '<font size="' + size + '" color="' + color + '">' + value + '</font>' + link2 + '</td>'
                                    + '</tr>'
                                + '</table>'
                            + '</th>'
                        + '</table>'
                    + '</td>'
                    + '<td style="background:inherit; height: 90px;"></td>'
                + '</tr>'
            + '</table>'

            document.getElementById('content').appendChild(div);
        }


        // Renders the table of outputs data, a specific of this hash type
        function renderOutputTable(data) {
            var div = document.createElement('div');
            div.className = 'row';
            var coinValue = ""
            if (data[1].ScValue > 0) {
                coinValue = readable(data[1].ScValue) + " SC"
            } else if (data[1].SfValue > 0) {
                coinValue = data[1].SfValue + " SF"
            }
            if (data[1].CreatedOnBlock == null) {data[1].CreatedOnBlock = "-"}
            if (data[1].SpentOnBlock == null) {data[1].SpentOnBlock = "-"}

            if (data[1].Spent == true) {
                var colorSpent = theme.red
                var textSpent = "Spent"
            } else {
                var colorSpent = theme.accent
                var textSpent = "Unspent"
            }
                
            var tableCode = '<table id="table-fill" class="table-outer" style="width: 1150px">' 
                + '<thead>'
                    + '<tr>'
                        + '<th colspan="2" class="text-left">'
                            + '<span style="vertical-align:center; margin: 0px 0px 0px 5px"><strong><font size="3">Output information:</font></strong></span>'
                        + '</th>'
                    + '</tr>'
                    + '<tr>'
                        + '<td>'
                            + '<span style="vertical-align:center"><font size="3">Belongs to address:</font></span>'
                        + '</td>'
                        + '<td>'
                            + '<span style="vertical-align:center; font-size:10px"><code><a href=' + htmlPath + "?search=" + data[1].Address 
                                + '>' + data[1].Address + '</a></code></span>'
                        + '</td>'
                    + '</tr>'
                    + '<tr>'
                        + '<td>'
                            + '<span style="vertical-align:center"><font size="3">Value:</font></span>'
                        + '</td>'
                        + '<td>'
                            + '<span style="vertical-align:center; font-size:medium">' + coinValue + '</span>'
                        + '</td>'
                    + '</tr>'
                    + '<tr>'
                        + '<td>'
                            + '<span style="vertical-align:center"><font size="3">Created on block:</font></span>'
                        + '</td>'
                        + '<td>'
                            + '<span style="vertical-align:center; font-size:medium">' + data[1].CreatedOnBlock + '</span>'
                        + '</td>'
                    + '</tr>'
                    + '<tr>'
                        + '<td>'
                            + '<span style="vertical-align:center"><font size="3">Spent / Unspent:</font></span>'
                        + '</td>'
                        + '<td>'
                            + '<span style="vertical-align:center; background: ' + colorSpent 
                                + '; color: ' + theme.black + '; padding: 0px 20px; border-radius: 10px; font-weight: 700;"><font size="3">' 
                                + textSpent + '</font></span>'
                        + '</td>'
                    + '</tr>'
                    + '<tr>'
                        + '<td>'
                            + '<span style="vertical-align:center"><font size="3">Spent on block:</font></span>'
                        + '</td>'
                        + '<td>'
                            + '<span style="vertical-align:center; font-size:medium">' + data[1].SpentOnBlock + '</span>'
                        + '</td>'
                    + '</tr>'

            // This closes the table
            tableCode = tableCode + '</thead> </table>'
            div.innerHTML = tableCode
            document.getElementById('content2').appendChild(div);

            // Re-adjustements of the layout
            adjustWidth()
            document.getElementById("loader2").style.display = 'none';
        }


        // Renders tables for the rest of hash types
        function renderTxTable(data, hashType) {
            var blockLink = htmlPath + "?search=" + data[1].Height
            var confirmations = auxblock[0].consensusblock - data[1].Height + 1
            var color = ""
            if (confirmations < 10) {
                color = theme.yellow
            } else if (confirmations >= 10 && confirmations < 72) {
                color = theme.lime
            } else {
                color = theme.accent
                confirmations = "72+"
            }
            var timestamp = timeConverter(data[1].Timestamp)
            if (data[0].Type != "contractresol" && data[0].Type != "contract") { // In resolutions and contracts, there are no synonyms
                var synonyms = processSynonyms(data[1].HashSynonyms)
            }
            if (data[0].Type == "revision") {
                var synonyms = data[1].MasterHash + ", " + data[1].HashSynonyms
            } else if (data[0].Type == "contractresol") {
                // We display the contractID instead of the synonyms
                var synonyms = data[1].ContractId
            }

            // Totals transacted. Not if a contract
            if (data[0].Type == "contract") {
                transacted = readable(data[1].RenterValue + data[1].HostValue) + " SC"
            } else {
                var totalSc = 0
                var totalSf = 0
                for (var n = 0; n < data[2].transactions.length; n++) {
                        if (data[2].transactions[n].ScChange > 0) {
                            totalSc = totalSc + data[2].transactions[n].ScChange
                        } else if (data[2].transactions[n].SfChange > 0) {
                            totalSf = totalSf + data[2].transactions[n].SfChange
                        }
                    }
                transacted = readable(totalSc + data[1].Fees) + " SC"
                
                // Add SF to the result, only when there were trasnacted
                if (totalSf != 0) {
                    transacted = transacted + " / " + totalSf + " SF"
                }
            }

            var div = document.createElement('div');
            div.className = 'row';
            var tableCode = '<table id="table-fill" class="table-outer" style="width: 1150px">' 
                + '<thead>'
                    + '<tr>'
                        + '<th colspan="2" class="text-left">'
                            + '<span style="vertical-align:center; margin: 0px 0px 0px 5px"><strong><font size="3">Transaction information:</font></strong></span>'
                        + '</th>'
                    + '</tr>'
                    + '<tr>'
                        + '<td>'
                            + '<span style="vertical-align:center"><font size="3">Transaction type:</font></span>'
                        + '</td>'
                        + '<td>'
                            + '<span style="vertical-align:center; font-size:medium">' + hashType + '</span>'
                        + '</td>'
                    + '</tr>'
                    + '<tr>'
                        + '<td>'
                            + '<span style="vertical-align:center"><font size="3">Height:</font></span>'
                        + '</td>'
                        + '<td><a href=' + blockLink + ' style="display:block">'
                            + '<span style="vertical-align:center; font-size:medium">' + data[1].Height + '</span>'
                            + '<span style="vertical-align:center; font-size:medium; padding: 0px 15px; margin: 0px 30px; background: ' + color + '; border-radius: 10px; color: ' + theme.black + '; font-weight: 700">'
                                + confirmations + ' confirmations'
                            + '</span></a>'
                        + '</td>'
                    + '</tr>'
                    + '<tr>'
                        + '<td>'
                            + '<span style="vertical-align:center"><font size="3">Timestamp:</font></span>'
                        + '</td>'
                        + '<td>'
                            + '<span style="vertical-align:center; font-size:medium">' + timestamp + '</span>'
                        + '</td>'
                    + '</tr>'
                    + '<tr>'
                        + '<td>'
                            + '<span style="vertical-align:center"><font size="3">Total transacted:</font></span>'
                        + '</td>'
                        + '<td>'
                            + '<span style="vertical-align:center; font-size:medium">' + transacted + '</span>'
                        + '</td>'
                    + '</tr>'
            
            // Additions for certain TX types

            if (data[0].Type == "allowancePost" || data[0].Type == "collateralPost") {
                // In these cases, the Synonyms field is showing the Contract ID
                var contractLink = htmlPath + "?search=" + data[1].HashSynonyms
                var tableCode = tableCode       
                    + '<tr>'
                        + '<td>'
                            + '<span style="vertical-align:center"><font size="3">Related Contract ID:</font></span>'
                        + '</td>'
                        + '<td>'
                            + '<span  style="vertical-align:center; font-size: 11px"><a href=' + contractLink + '>' 
                            + synonyms + '</span>'
                        + '</td>'
                    + '</tr>'

            } else if (data[0].Type == "contractresol" || data[0].Type == "contract") {
                // In these cases, showing the Contract ID
                var contractLink = htmlPath + "?search=" + data[1].ContractId
                if (data[0].Type == "contract") {
                    if (data[1].Result == "fail" || data[1].Status == "complete-fail") {
                        if (data[1].MissedProof3Value == "0" || data[1].Output2Value == "0") {
                            var colorResult = theme.yellow
                            var textResult = "Unused"
                        } else {
                            var colorResult = theme.red
                            var textResult = "Failed"
                        }
                    } else if (data[1].Result == "success" || data[1].Status == "complete-succ") {
                        if (data[1].MissedProof2Value == data[1].ValidProof2Value || data[0].Type == "contractresol") {
                            var colorResult = theme.yellow
                            var textResult = "Unused"
                        } else {
                            var colorResult = theme.accent
                            var textResult = "Successful"
                        } 
                    } else if (data[1].Status == "ongoing") {
                        var colorResult = theme.grey2
                        var textResult = "Ongoing"
                    }
                } else {
                    // Contract resolutions
                    if (data[1].Result == "success") {
                        var colorResult = theme.accent
                        var textResult = "Successful"
                    } else {
                        var colorResult = theme.red
                        var textResult = "Failed"
                    }
                }
                

                var tableCode = tableCode       
                    + '<tr>'
                        + '<td>'
                            + '<span style="vertical-align:center"><font size="3">Related Contract ID:</font></span>'
                        + '</td>'
                        + '<td>'
                            + '<span  style="vertical-align:center; font-size: 11px"><a href=' + contractLink + '>' 
                            + data[1].ContractId + '</span>'
                        + '</td>'
                    + '</tr>'
                    + '<tr>'
                        + '<td>'
                            + '<span style="vertical-align:center"><font size="3">Contract status:</font></span>'
                        + '</td>'
                        + '<td>'
                            + '<span style="vertical-align:center; background: ' + colorResult + '; color: ' + theme.black + '; padding: 0px 20px; border-radius: 10px; font-weight: 700;"><font size="3">' 
                            + textResult + '</font></span>'
                        + '</td>'
                    + '</tr>'
            }

            if (data[0].Type == "contract") {
                    if (data[1].Renew == true) {
                        var renewWord = "Renewal"
                    } else {
                        var renewWord = "New"
                    }
                    var tableCode = tableCode
                        + '<tr><td>'
                                + '<span style="vertical-align:center"><font size="3">New / Renewal:</font></span>'
                            + '</td><td>'
                                + '<span style="vertical-align:center; font-size: medium">' + renewWord + '</span>'
                        + '</td></tr>'
                        + '<tr><td>'
                                + '<span style="vertical-align:center"><font size="3">File size at contract formation:</font></span>'
                            + '</td><td>'
                                + '<span style="vertical-align:center; font-size: medium">' + (data[1].OriginalFileSize/1000000000).toFixed(2) + ' GB</span>'
                        + '</td></tr>'
                        + '<tr><td>'
                                + '<span style="vertical-align:center"><font size="3">File size at last revision:</font></span>'
                            + '</td><td>'
                                + '<span style="vertical-align:center; font-size: medium">' + (data[1].CurrentFileSize/1000000000).toFixed(2) + ' GB</span>'
                        + '</td></tr>'
                        + '<tr><td>'
                                + '<span style="vertical-align:center"><font size="3">Last revision number:</font></span>'
                            + '</td><td>'
                                + '<span style="vertical-align:center; font-size: medium">' + data[1].RevisionNum + '</span>'
                        + '</td></tr>'
                        + '<tr><td>'
                                + '<span style="vertical-align:center"><font size="3">Window for proof of storage:</font></span>'
                            + '</td><td>'
                                + '<span style="vertical-align:center; font-size: medium">' + data[1].WindowStart + " - " + data[1].WindowEnd + '</span>'
                        + '</td></tr>'
            } else if (data[0].Type == "revision") {
                    var tableCode = tableCode
                        + '<tr><td>'
                                + '<span style="vertical-align:center"><font size="3">New revision number:</font></span>'
                            + '</td><td>'
                                + '<span style="vertical-align:center; font-size: medium">' + data[1].NewRevisionNum + '</span>'
                        + '</td></tr>'
                        + '<tr><td>'
                                + '<span style="vertical-align:center"><font size="3">New file size:</font></span>'
                            + '</td><td>'
                                + '<span style="vertical-align:center; font-size: medium">' + (data[1].NewFileSize/1000000000).toFixed(2) + ' GB</span>'
                        + '</td></tr>'

            }

            if (data[0].Type == "contract") {
                    // SiaFund fees
                    var sfFees = data[1].SfFees
                    var feesPercentage = (sfFees / (data[1].ValidProof1Value + data[1].ValidProof2Value + data[1].Fees 
                        + sfFees - data[1].HostValue) * 100).toFixed(2) // This avoid some errors on contracts formed by `us`
                    var feesCell = readable(sfFees) + " SC <font size=2>(" + feesPercentage + "% of the renter's allowance)</font>"
                    //feesCell = feesPercentage
                    var tableCode = tableCode
                        + '<tr><td>'
                                + '<span style="vertical-align:center"><font size="3">Fees paid to SF holders:</font></span>'
                            + '</td><td>'
                                + '<span style="vertical-align:center; font-size: medium">' + feesCell + '</span>'
                        + '</td></tr>'
            }

            if (data[0].Type == "contract" || data[0].Type == "revision") {
                    var tableCode = tableCode
                        + '<tr><td>'
                                + '<span style="vertical-align:center"><font size="3">Conditions upon success:</font></span>'
                            + '</td><td style="padding: 10px 15px">'
                                + '<span style="vertical-align:center; font-size: medium">' 
                                    + '<svg style="vertical-align:middle; width: 20px; height: 20px; padding: 0px 10px 0px 0px"><use xlink:href="#renter-text" class="icon-text"/></svg>'
                                    + " Returned allowance: " + readable(data[1].ValidProof1Value) + ' SC <br><br>'
                                    + '<svg style="vertical-align:middle; width: 20px; height: 20px; padding: 0px 10px 0px 0px"><use xlink:href="#host-text" class="icon-text"/></svg>'
                                    + " Payout + collateral: " + readable(data[1].ValidProof2Value) + ' SC</span>'
                        + '</td></tr>'
                        + '<tr><td>'
                                + '<span style="vertical-align:center"><font size="3">Conditions upon fail:</font></span>'
                            + '</td><td style="padding: 10px 15px">'
                                + '<span style="vertical-align:center; font-size: medium">' 
                                    + '<svg style="vertical-align:middle; width: 20px; height: 20px; padding: 0px 10px 0px 0px"><use xlink:href="#renter-text" class="icon-text"/></svg>'
                                    + " Returned allowance: " + readable(data[1].MissedProof1Value) + ' SC <br><br>'
                                    + '<svg style="vertical-align:middle; width: 20px; height: 20px; padding: 0px 10px 0px 0px"><use xlink:href="#host-text" class="icon-text"/></svg>'
                                    + " Returned collateral: " + readable(data[1].MissedProof2Value) + ' SC <br><br>'
                                    + '<svg style="vertical-align:middle; width: 20px; height: 20px; padding: 0px 10px 0px 0px"><use xlink:href="#burn-text" class="icon-text"/></svg>'
                                    + " Burnt collateral: " + readable(data[1].MissedProof3Value) + ' SC </span>'
                        + '</td></tr>'
            
            } else if (data[0].Type == "storageproof") {
                // In these cases, the Synonyms field is showing the Contract ID
                var contractLink = htmlPath + "?search=" + data[1].ContractId
                var tableCode = tableCode       
                    + '<tr>'
                        + '<td>'
                            + '<span style="vertical-align:center"><font size="3">Related Contract ID:</font></span>'
                        + '</td>'
                        + '<td>'
                            + '<span style="vertical-align:center; font-size: 11px"><a href=' + contractLink + '>' 
                            + data[1].ContractId + '</span>'
                        + '</td>'
                    + '</tr>'
                    + '<tr>'
                        + '<td>'
                            + '<span style="vertical-align:center"><font size="3">Synonym hashes:</font></span>'
                        + '</td>'
                        + '<td>'
                            + '<span style="vertical-align:center; font-size: 11px">' + synonyms + '</span>'
                        + '</td>'
                    + '</tr>'
            
            } else  if (data[0].Type == "host ann") {
                tableCode = tableCode
                    + '<tr>'
                        + '<td>'
                            + '<span style="vertical-align:center"><font size="3">Announced host:</font></span>'
                        + '</td>'
                        + '<td>'
                            + '<span id="data3" style="vertical-align:center; font-size: medium">' + data[1].IP + '</span>'
                        + '</td>'
                    + '</tr>'
            }

            // Adding synonyms:
            if (data[0].Type != "blockreward" && data[0].Type != "storageproof" && data[0].Type != "allowancePost" && data[0].Type != "collateralPost" 
                && data[0].Type != "contract" && data[0].Type != "contractresol") {
                var tableCode = tableCode       
                    + '<tr>'
                        + '<td>'
                            + '<span style="vertical-align:center"><font size="3">Synonym hashes:</font></span>'
                        + '</td>'
                        + '<td>'
                            + '<span style="vertical-align:center; font-size: 11px">' + synonyms + '</span>'
                        + '</td>'
                    + '</tr>'
            }

            // Adding a link to the raw transaction
            if (searchQuery.slice(searchQuery.length-1) == "R" || searchQuery.slice(0,2) == "BR") {
                // We don't show a RAW link for these artificial transactions
            } else {
                var tableCode = tableCode       
                    + '<tr>'
                        + '<td>'
                            + '<span style="vertical-align:center"><font size="3">Raw transaction:</font></span>'
                        + '</td>'
                        + '<td>'
                            + '<span style="vertical-align:center; font-size: 11px"><a style="color: ' + theme.text + '" href=' + apiPath + '/raw/' + searchQuery + '>'
                                + '<i style="font-size:22px" class="fa fa-external-link"></i>'
                            + '</a></span>'
                        + '</td>'
                    + '</tr>'
            }
            
            // This closes the table
            tableCode = tableCode + '</thead> </table>'
            div.innerHTML = tableCode
            document.getElementById('content2').appendChild(div);

            // Re-adjustements of the layout
            adjustWidth()
            document.getElementById("loader2").style.display = 'none';
        }


        function renderContractRelated(data) {
            
            var div = document.createElement('div');
            div.className = 'row';
            var tableCode = '<table id="table-fill" class="table-outer" style="width: 1150px">' 
                + '<thead>'
                    + '<tr>'
                        + '<th colspan="5" class="text-left">'
                            + '<span style="vertical-align:center; margin: 0px 0px 0px 5px"><strong><font size="3">Contract related operations:</font></strong></span>'
                        + '</th>'

            if (data[2].Height >= 0) { // Only if there is a Revision
                tableCode = tableCode
                    + '</tr>'
                    + '<tr style="height: 50px">'
                        + '<td style="border-right: 0px">'
                            + '<svg style="width: 30px; height: 30px"><use xlink:href="#revision-text" class="icon-text"/></svg>'
                        + '<td style="padding: 0px 0px 0px 10px; border-right: 0px; font-size:medium"><a href=' + htmlPath + '?search=' + data[2].MasterHash + '> Contract revision </a></td>'
                        + '</td>'
                        + '<td style="font-size:x-small; border-right: 0px"><a href=' + htmlPath + '?search=' + data[2].MasterHash + '>'
                        + shortHash(data[2].MasterHash) + '</a></td>'
                        + '<td style="border-right: 0px"><a href=' + htmlPath + '?search=' + data[2].Height + '>'
                            + '<span style="vertical-align:center; font-size:small">Block: ' + data[2].Height + '</span></a>'
                        + '</td>'
                        + '<td style="font-size:small; border-right: 0px">' + timeConverter(data[2].Timestamp) + '</td>'
                    + '</tr>'
            }
            if (data[4].Height >= 0) { // Only if there is an Storage Proof
                tableCode = tableCode
                    + '<tr style="height: 50px">'
                        + '<td style="border-right: 0px">'
                            + '<svg style="width: 30px; height: 30px"><use xlink:href="#storageproof-text" class="icon-text"/></svg>'
                        + '<td style="padding: 0px 0px 0px 10px; border-right: 0px; font-size:medium"><a href=' + htmlPath + '?search=' + data[4].MasterHash + '> Storage proof </a></td>'
                        + '</td>'
                        + '<td style="font-size:x-small; border-right: 0px"><a href=' + htmlPath + '?search=' + data[4].MasterHash + '>'
                        + shortHash(data[4].MasterHash) + '</a></td>'
                        + '<td style="border-right: 0px"><a href=' + htmlPath + '?search=' + data[4].Height + '>'
                            + '<span style="vertical-align:center; font-size:small">Block: ' + data[4].Height + '</span></a>'
                        + '</td>'
                        + '<td style="font-size:small; border-right: 0px">' + timeConverter(data[4].Timestamp) + '</td>'
                    + '</tr>'
            }
            if (data[3].Height >= 0) { // Only if there is a Resolution
                tableCode = tableCode
                    + '<tr style="height: 50px">'
                        + '<td style="border-right: 0px">'
                            + '<svg style="width: 30px; height: 30px"><use xlink:href="#contractresol-text" class="icon-text"/></svg>'
                        + '<td style="padding: 0px 0px 0px 10px; border-right: 0px; font-size:medium"><a href=' + htmlPath + '?search=' + data[3].MasterHash + '> Contract resolution </a></td>'
                        + '</td>'
                        + '<td style="font-size:x-small; border-right: 0px"><a href=' + htmlPath + '?search=' + data[3].MasterHash + '>'
                        + shortHash(data[3].MasterHash) + '</a></td>'
                        + '<td style="border-right: 0px"><a href=' + htmlPath + '?search=' + data[3].Height + '>'
                            + '<span style="vertical-align:center; font-size:small">Block: ' + data[3].Height + '</span></a>'
                        + '</td>'
                        + '<td style="font-size:small; border-right: 0px">' + timeConverter(data[3].Timestamp) + '</td>'
                    + '</tr>'
            }
            
            // This closes the table
            tableCode = tableCode + '</thead> </table>'
            div.innerHTML = tableCode
            document.getElementById('content2').appendChild(div);    
        }

        function renderContractTimeline(data) {
            // Shows a timeline representation of the contract

            // A table header
            var div = document.createElement('div');
            div.className = 'row';
            div.innerHTML =
                '<table id="table-fill" class="table-outer" style="width: 1150px; height: 25px; margin: 0px auto; box-shadow: none">' 
                    + '<thead>'
                        + '<tr>'
                            + '<th class="text-left">'
                                + '<span style="vertical-align:center; margin: 0px 0px 0px 5px"><strong><font size="3">File Contract timeline:</font></strong></span>'
                            + '</th>'
                        + '</tr>'
                    + '</thead>'
                + '</table>'
                + '<div id="timeline" class="table-outer" style="height: 200px; margin: 0px auto; padding: 0px auto; width: 1150px" ></div>'
            document.getElementById('content4').appendChild(div);
            
            // Google charts timeline
            google.charts.load('current', {'packages':['timeline']});
            google.charts.setOnLoadCallback(drawChart);
            function drawChart() {

                // Preparing the dates for the chart
                var timestamp = parseInt(data[1].Timestamp)
                var contractStart = new Date(timestamp * 1000)
                var contractEndPre = timestamp + ((data[1].WindowStart - data[1].Height) * 600)
                var contractEnd = new Date(contractEndPre * 1000)
                var windowStart = new Date((contractEndPre + 1) * 1000)
                var windowEndPre = timestamp + ((data[1].WindowEnd - data[1].Height) * 600)
                var windowEnd = new Date(windowEndPre * 1000)
                var revisionStartPre = timestamp + ((data[2].Height - data[1].Height) * 600) - 10000
                var revisionStart = new Date(revisionStartPre * 1000)
                var revisionEndPre = timestamp + ((data[2].Height - data[1].Height) * 600) + 10000
                var revisionEnd = new Date(revisionEndPre * 1000)
                if (data[3].Result == "success") { // Only show successful proofs
                    var proofStartPre = timestamp + ((data[4].Height - data[1].Height) * 600) - 10000
                    var proofStart = new Date(proofStartPre * 1000)
                    var proofEndPre = timestamp + ((data[4].Height - data[1].Height) * 600) + 10000
                    var proofEnd = new Date(proofEndPre * 1000)
                } else {
                    var proofStart = new Date("")
                    var proofEnd = new Date("")
                }

                var container = document.getElementById('timeline');
                document.getElementById('content4').appendChild(div);
                var chart = new google.visualization.Timeline(container);
                var dataTable = new google.visualization.DataTable();

                dataTable.addColumn({ type: 'string', id: 'President' });
                dataTable.addColumn({ type: 'string', id: 'Name' });
                dataTable.addColumn({ type: 'date', id: 'Start' });
                dataTable.addColumn({ type: 'date', id: 'End' });
                dataTable.addRows([
                    [ 'Contract span', "Contract: " + data[1].ContractId, contractStart, contractEnd],
                    [ 'Contract span', "Proof Window", windowStart, windowEnd]
                ]);

                if (data[2].MasterHash != null) {
                    dataTable.addRows([
                        [ 'Revision', "Revision: " + data[2].MasterHash, revisionStart, revisionEnd]
                    ])
                }
                if (data[3].MasterHash != null) {
                    dataTable.addRows([
                        [ 'Storage proof', "Storage proof: " + data[4].MasterHash, proofStart, proofEnd]
                    ])
                }

                var options = {
                    timeline: { showBarLabels: false, 
                        rowLabelStyle: {color: theme.text },
                    },
                    colors: [theme.grey3, 'orange', theme.brightRed, theme.darkGreen],
                    backgroundColor: theme.black,
                };
                
                // This block of code changes the color of the time axis labels
                google.visualization.events.addListener(chart, 'ready', function () {
                    var labels = container.getElementsByTagName('text');
                    Array.prototype.forEach.call(labels, function(label) {
                        label.setAttribute('fill', theme.text);
                    });
                });

                chart.draw(dataTable, options);
            }
        }


        function renderError(search) {
            // Renders the error message
            var div = document.createElement('div');
            div.className = 'row';
            var tableCode = '<div\ style="margin: 50px auto; width: 500px; color: ' + theme.decoration + '; text-align: left">'
                    + '<span style="font-size: 80px">:-( <br></span>'
                    + '<span style="font-size: 40px">Hash not found<br></span>'
                    + '<span style="font-size: 20px">If the transaction was recently broadcasted or included on a block, wait a few seconds and refresh<br></span>'
                    + '<span style="font-size: 20px">Search also in the official Sia Explorer'
                        + '<a style="color: ' + theme.decoration + '" href="https://explore.sia.tech/hashes/' + search + '">'
                            + '<i style="font-size:20px; padding: 0px 0px 0px 5px" class="fa fa-external-link"></i>'
                        + '</a></span>'
                + '</div>'
            div.innerHTML = tableCode
            document.getElementById('content').appendChild(div);
        }


        function renderQrAndBalance(data, address) {
            // Finding the first block the address was seen
            var txs = data[1].last100Transactions
            txs.sort(function(a, b) {
                return parseFloat(b.Height) - parseFloat(a.Height);
            });

            // Unconfirmed balances
            var pendingDiv = ""
            if (data[1].pendingSc == 0 && data[1].pendingSf == 0) { pendingDiv = "0 SC / 0 SF" }
            if (data[1].pendingSc > 0) {
                pendingDiv = "<font style='color: " + theme.darkGreen + "'>+" + readable(data[1].pendingSc) + " SC</font>"
            } else if (data[1].pendingSc < 0) {
                pendingDiv = "<font style='color: " + theme.brightRed + "'>" + readable(data[1].pendingSc) + " SC</font>"
            }
            if (data[1].pendingSc != 0 && data[1].pendingSf != 0) { pendingDiv = pendingDiv + " / "}
            if (data[1].pendingSf > 0) {
                pendingDiv = pendingDiv + "<font style='color: purple'>+" + data[1].pendingSf + " SF</font>"
            } else if (data[1].pendingSf < 0) {
                pendingDiv = pendingDiv + "<font style='color: orange'>" + data[1].pendingSf + " SF</font>"
            }

            // Renders the balance table and a QR code of the address
            var div = document.createElement('div');
            div.className = 'row';
            var tableCode = '<div class="home-outer" style="height:225px;">'
                + '<div class="home-inner table-address" style="padding: 0px 25px; width: 700px; height:275px;">'
                    + '<div class="home-element">'
                        + '<table id="table-fill" class="table-outer" style="margin: 0px">'
                            + '<thead>'
                                + '<tr style="height: 25px">'
                                    + '<th colspan="2" class="text-left" style="height: 25px;">'
                                        + '<span style="vertical-align:center; margin: 0px 0px 0px 5px"><strong><font size="3">Address summary:</font></strong></span>'
                                    + '</th>'
                                + '</tr>'
                                + '<tr>'
                                    + '<td style="height: 65px; padding: 0px 15px; font-size:110%; vertical-align:center;">Confirmed Siacoin balance: </td>'
                                    + '<td style="height: 65px; padding: 0px 15px; font-size:110%; vertical-align:center; text-align: right">' + readable(data[1].balanceSc) + ' SC'
                                        + '<br><span style="font-size: 12px">' + readable(data[1].receivedSc) + ' SC received / -' + readable(data[1].sentSc) + ' SC sent</span></td>'
                                + '</tr>'
                                + '<tr>'
                                    + '<td style="height: 45px; padding: 0px 15px; font-size:110%; vertical-align:center;">Confirmed Siafund balance: </td>'
                                    + '<td style="height: 45px; padding: 0px 15px; font-size:110%; vertical-align:center; text-align: right">' + data[1].balanceSf + ' SF</td>'
                                + '</tr>'
                                + '<tr>'
                                    + '<td style="height: 45px; padding: 0px 15px; font-size:110%; vertical-align:center;">Pending transactions: </td>'
                                    + '<td style="height: 45px; padding: 0px 15px; font-size:110%; vertical-align:center; text-align: right">' + pendingDiv + '</td>'
                                + '</tr>'
                                + '<tr>'
                                    + '<td style="height: 45px; padding: 0px 15px; font-size:110%; vertical-align:center;">Number of transactions: </td>'
                                    + '<td style="height: 45px; padding: 0px 15px; font-size:120%; vertical-align:center; text-align: right">' + data[1].TotalTxCount + '</td>'
                                + '</tr>'
                                + '<tr>'
                                    + '<td style="height: 45px; padding: 0px 15px; font-size:110%; vertical-align:center;">First seen (block): </td>'
                                    + '<td style="height: 45px; padding: 0px 15px; font-size:110%; vertical-align:center; text-align: right">' + data[1].firstSeen + '</td>'
                                + '</tr>'
                            + '</thead>'
                        + '</table>'
                    + '</div>'
                + '</div>'
                + '<div class="home-inner qr-code" style="height:270px; padding: 0px 0px 75px 25px; width: 400px;">'
                    + '<div id="card-qr" class="card-qr">'
                        + '<object style="margin: 25px 95px auto; height: 225px" data="' + apiPath + '/qr/' + address + '.svg" type="image/svg+xml"></object>'
                    + '</div>'
                + '</div>'
            + '</div>'
            
            div.innerHTML = tableCode
            document.getElementById('content').appendChild(div);
        }


        function renderTxInBlock(data) {
            // This function splits the list of transactions in 3 categories and calls a function to draw 3 tables
            var scTxs = []
            var contracts = []
            var others = []
            for (n = 0; n < data[2].transactions.length; n++) {
                if (data[2].transactions[n].TxType == "ScTx") {
                    scTxs.push(data[2].transactions[n])
                } else if (data[2].transactions[n].TxType == "SfTx" || data[2].transactions[n].TxType == "blockreward" || data[2].transactions[n].TxType == "host ann") {
                    others.push(data[2].transactions[n])
                } else {
                    contracts.push(data[2].transactions[n])
                }
            }
            // Sorting arrays
            others.sort(function(a,b) {return (a.TxType > b.TxType) ? 1 : ((b.TxType > a.TxType) ? -1 : 0);} );
            contracts.sort(function(a,b) {return (a.TxType > b.TxType) ? 1 : ((b.TxType > a.TxType) ? -1 : 0);} );

            var text = "Siacoin transactions"
            drawBlockTxTable(scTxs, text)
            var text2 = "File contracts activity"
            drawBlockTxTable(contracts, text2)
            var text3 = "Other transactions"
            drawBlockTxTable(others, text3)

            // Re-adjustements of the layout
            document.getElementById("loader2").style.display = 'none';
            adjustWidth()
        }

        function drawBlockTxTable(txs, text) {
            // Draws a table with transactions of an specific kind
            var div = document.createElement('div');
            div.className = 'row';
            var tableCode = '<table id="table-fill" class="table-outer" style="width: 1150px">' 
                + '<thead>'
                    + '<tr>'
                        + '<th colspan="6" class="text-left">'
                            + '<span style="vertical-align:center; margin: 0px 0px 0px 5px"><strong><font size="3">' + text + ':</font></strong></span>'
                        + '</th>'
                    + '</tr>'
            
            // Iterates on each transaction
            for (var n = 0; n < txs.length; n++) {
                // Tx type label and icon
                if (txs[n].TxType == "ScTx") {
                    var type = "Siacoin transfer"
                    var icon = "sctx"
                } else if (txs[n].TxType == "SfTx") {
                    var type = "Siafund transfer"
                    var icon = "sftx"
                } else if (txs[n].TxType == "blockreward") {
                    var type = "Block reward"
                    var icon = "miner"
                } else if (txs[n].TxType == "storageproof") {
                    var type = "Storage proof"
                    var icon = "storageproof"
                } else if (txs[n].TxType == "allowancePost") {
                    var type = "Allowance posting"
                    var icon = "allowance"
                } else if (txs[n].TxType == "collateralPost") {
                    var type = "Collateral posting"
                    var icon = "collateral"
                } else if (txs[n].TxType == "contractresol") {
                    var type = "Contract resolution"
                    var icon = "contractresol"
                } else if (txs[n].TxType == "revision") {
                    var type = "Contract revision"
                    var icon = "revision"
                } else if (txs[n].TxType == "contract") {
                    var type = "Contract formation"
                    var icon = "contract"
                } else if (txs[n].TxType == "host ann") {
                    var type = "Host announcement"
                    var icon = "hostann"
                } else if (txs[n].TxType == "contractform") {
                    var type = "Contract formation"
                    var icon = "contract"
                }

                if (txs[n].TxType == "SfTx") {
                    var value = txs[n].TotalAmountSf + " SF / " + readable(txs[n].TotalAmountSc) + " SC"
                } else {
                    var value = readable(txs[n].TotalAmountSc) + " SC"
                }


                tableCode = tableCode
                    + '<tr style="height: 35px">'
                        + '<td style="border-right: 0px">'
                            + '<svg style="vertical-align:middle; width: 25px; height: 25px"><use xlink:href="#' + icon + '-text" class="icon-text"/></svg>'
                        + '<td style="padding: 0px 0px 0px 10px; border-right: 0px; font-size:small"><a href=' + htmlPath + '?search=' + txs[n].TxHash + '>' + type + '</a></td>'
                        + '</td>'
                        + '<td style="font-size:x-small; border-right: 0px"><a href=' + htmlPath + '?search=' + txs[n].TxHash + '>'
                            + shortHash(txs[n].TxHash) + '</a></td>'
                        + '<td style="border-right: 0px; min-width: 115px; padding: 0px 10px 0px 0px; font-size:small; font-weight: bold; text-align: right">'
                            + value
                        + '</td>'
                    + '</tr>'
            }
            
            // This closes the table
            tableCode = tableCode + '</thead> </table>'
            div.innerHTML = tableCode
            document.getElementById('content3').appendChild(div); 
        }


        function renderBlockHTML(data, miner) {
            // Block card
            cardBackgroundColor = 'var(--oddCellsTable, #111111)';
            cardColor = 'var(--text, #c0c0c0)';

            // Navigation links
            var previousBlock = data[1].Height - 1
            if (previousBlock < 0) {previousBlock = 0}
            var nextBlock = data[1].Height + 1

            // Adjusting some fields:
            var readableDifficulty = ""
            if (data[1].Difficulty >= 1000000000000 && data[1].Difficulty < 1000000000000000) {readableDifficulty = ((data[1].Difficulty/1000000000000).toFixed(2)) + " TH"}
            else if (data[1].Difficulty >= 1000000000000000 && data[1].Difficulty < 1000000000000000000) {readableDifficulty = ((data[1].Difficulty/1000000000000000).toFixed(2)) + " PH"}
            else if (data[1].Difficulty >= 1000000000000000000 && data[1].Difficulty < 1000000000000000000000) {readableDifficulty = ((data[1].Difficulty/1000000000000000000).toFixed(2)) + " EH"}
            var difficulty = readableDifficulty + ' <span style="font-size: 70%; padding: 0px 0px 0px 10px">' + data[1].Difficulty + " H</span>"

            var readableHashrate = ""
            if (data[1].Hashrate >= 1000000000 && data[1].Hashrate < 1000000000000) {readableHashrate = ((data[1].Hashrate/1000000000).toFixed(2)) + " GH/s"}
            else if (data[1].Hashrate >= 1000000000000 && data[1].Hashrate < 1000000000000000) {readableHashrate = ((data[1].Hashrate/1000000000000).toFixed(2)) + " TH/s"}
            else if (data[1].Hashrate >= 1000000000000000 && data[1].Hashrate < 1000000000000000000) {readableHashrate = ((data[1].Hashrate/1000000000000000).toFixed(2)) + " PH/s"}
            var hashrate = readableHashrate + ' <span style="font-size: 70%; padding: 0px 0px 0px 10px">' + data[1].Hashrate + " H/s</span>"

            var readableContractsize = ""
            if (data[1].TotalContractSize >= 1099511627776 && data[1].TotalContractSize < 1125899906842624) {readableContractsize = ((data[1].TotalContractSize/1099511627776).toFixed(2)) + " TB"}
            if (data[1].TotalContractSize >= 1125899906842624 && data[1].TotalContractSize < 1152921504606846976) {readableContractsize = ((data[1].TotalContractSize/1125899906842624).toFixed(2)) + " PB"}
            if (data[1].TotalContractSize >= 1152921504606846976 && bdata[1].TotalContractSize < 1180591620717411303424) {readableContractsize = ((data[1].TotalContractSize/1152921504606846976).toFixed(2)) + " EB"}
            var contractSize = readableContractsize + ' <span style="font-size: 70%; padding: 0px 0px 0px 10px">' + data[1].TotalContractSize + " bytes</span>"

            readableContractcost = ""
            if (data[1].TotalContractCost >= 1000000000000000000000000000000 && data[1].TotalContractCost < 1000000000000000000000000000000000) {readableContractcost = (data[1].TotalContractCost/1000000000000000000000000000000).toFixed(2) + " millions SC"}
            if (data[1].TotalContractCost >= 1000000000000000000000000000000000 && data[1].TotalContractCost < 1000000000000000000000000000000000000) {readableContractcost = (data[1].TotalContractCost/1000000000000000000000000000000000).toFixed(2) + " billions SC"}
            var contractCost = readableContractcost + ' <span style="font-size: 70%; padding: 0px 0px 0px 10px">' + parseInt(data[1].TotalContractCost / 1000000000000000000000000) + " SC</span>"

            var readableActivecontractsize = ""
            if (data[1].ActiveContractSize >= 1073741824 && data[1].ActiveContractSize < 1099511627776) {readableActivecontractsize = ((data[1].ActiveContractSize/1073741824).toFixed(2)) + " GB"}
            if (data[1].ActiveContractSize >= 1099511627776 && data[1].ActiveContractSize < 1125899906842624) {readableActivecontractsize = ((data[1].ActiveContractSize/1099511627776).toFixed(2)) + " TB"}
            if (data[1].ActiveContractSize >= 1125899906842624 && data[1].ActiveContractSize < 1152921504606846976) {readableActivecontractsize = ((data[1].ActiveContractSize/1125899906842624).toFixed(2)) + " PB"}
            if (data[1].ActiveContractSize >= 1152921504606846976 && data[1].ActiveContractSize < 1180591620717411303424) {readableActivecontractsize = ((data[1].ActiveContractSize/1152921504606846976).toFixed(2)) + " EB"}
            var activeContractSize = readableActivecontractsize + ' <span style="font-size: 70%; padding: 0px 0px 0px 10px">' + data[1].ActiveContractSize + " bytes</span>"

            var readableActivecontractcost = ""
            if (data[1].ActiveContractCost >= 1000000000000000000000000000000 && data[1].ActiveContractCost < 1000000000000000000000000000000000) {readableActivecontractcost = (data[1].ActiveContractCost/1000000000000000000000000000000).toFixed(2) + " millions SC"}
            if (data[1].ActiveContractCost >= 1000000000000000000000000000000000 && data[1].ActiveContractCost < 1000000000000000000000000000000000000) {readableActivecontractcost = (data[1].ActiveContractCost/1000000000000000000000000000000000).toFixed(2) + " billions SC"}
            var activeContractCost = readableActivecontractcost + ' <span style="font-size: 70%; padding: 0px 0px 0px 10px">' + parseInt(data[1].ActiveContractCost / 1000000000000000000000000) + " SC</span>"

            var totalCoins = (data[1].TotalCoins/1000000000000000000000000000000000).toFixed(2) + ' billions of SC <span style="font-size: 70%; padding: 0px 0px 0px 10px">' + parseInt(data[1].TotalCoins/1000000000000000000000000) + " SC</span>"

            var div = document.createElement('div');
            div.className = 'row';
            var tableCode = '<div class="home-outer" style="height:340px">'
                    + '<div class="home-inner" style="height:390px">'
                        + '<div id="card" style="height:280px; margin: 0px auto; text-align: left; padding: 15px 20px; background-color: ' + cardBackgroundColor + '; color: ' + cardColor + '">'
                            + '<div width="200" style="float:left; width:200px">'
                                + '<svg style="width: 150px; height: 150px; filter: brightness(80%)"><use xlink:href="#block" class="icon-text"/></svg>'
                                    + '<p2 style="display: table-cell; vertical-align: bottom; padding: 70px 0px 0px 0px">'
                                        + 'mined by<br>'
                                    + '<b><font size="6">' + miner + '</font></b>'
                                + '</p2>'
                            + '</div>'
                            + '<div width="300px" style="float:right; text-align:right">'
                                + '<p2>'
                                    + 'block height<br>'
                                    + '<font size="7"><p2 style="font-weight: 900">' + data[1].Height + '</p2></font><br>'
                                    + '<b><font size="5">' + timeConverter(data[1].Timestamp) + '</font></b><br><br><br>'
                                    + 'new/renewed contracts<br>'
                                    + '<b><font size="6">' + data[1].NewContracts + '</font></b><br><br>'
                                    + 'new transactions<br>'
                                    + '<b><font size="6">' + data[1].NewTx + '</font></b>'
                                + '</p2>'
                            + '</div>'
                        + '</div>'
                        + '<div style="padding: 0px 100px; color: ' + theme.decorationSubtle + '; font-size: 100px; font-weight: 400">'
                            + '<span><a href=' + htmlPath + '?search=' + previousBlock + ' style="text-decoration:none; color:' + theme.decorationSubtle + '"> < </a></span>'
                            + '<span style="float: right"><a href=' + htmlPath + '?search=' + nextBlock + ' style="text-decoration:none; color:' + theme.decorationSubtle + '"> > </a></span>'                                                     
                        + '</div>'
                    + '</div>'
                    + '<div class="home-inner" style="padding: 0px 0px 75px 25px">'
                        + '<div class="home-element">'
                            + '<table id="table-fill" class="table-outer" style="margin: 0px">'
                                + '<thead>'
                                    + '<tr style="height: 25px">'
                                        + '<th colspan="2" class="text-left" style="height: 25px; padding: 0px 10px">'
                                            + '<span style="vertical-align:center; margin: 0px 0px 0px 5px"><strong><font size="3">Block metadata:</font></strong></span></th>'
                                    + '</tr>'
                                    + '<tr>'
                                        + '<td style="height: 30px; padding: 0px 15px; font-size:small">Height:</td>'
                                        + '<td style="height: 30px; padding: 0px 15px; font-size:small">' + data[1].Height + '</td>'
                                    + '</tr>'
                                    + '<tr>'
                                        + '<td style="height: 30px; padding: 0px 15px; font-size:small">Block hash:</td>'
                                        + '<td style="height: 30px; padding: 0px 15px; font-size:small; font-size:50%">' 
                                            + '<a href=' + htmlPath + '?search=' + data[1].Hash + '>' 
                                            + data[1].Hash + '</td>'
                                    + '</tr>'
                                    + '<tr>'
                                        + '<td style="height: 30px; padding: 0px 15px; font-size:small">Timestamp (local):</td>'
                                        + '<td style="height: 30px; padding: 0px 15px; font-size:small">' + timeConverter(data[1].Timestamp) + '</td>'
                                    + '</tr>'
                                    + '<tr>'
                                        + '<td style="height: 30px; padding: 0px 15px; font-size:small">Timestamp (Unix):</td>'
                                        + '<td style="height: 30px; padding: 0px 15px; font-size:small">' + data[1].Timestamp + '</td>'
                                    + '</tr>'
                                    + '<tr>'
                                        + '<td style="height: 30px; padding: 0px 15px; font-size:small">Mining pool:</td>'
                                        + '<td style="height: 30px; padding: 0px 15px; font-size:small">' + miner + '</td>'
                                    + '</tr>'
                                    + '<tr>'
                                        + '<td style="height: 30px; padding: 0px 15px; font-size:small">Miner payout address:</td>'
                                        + '<td style="height: 30px; padding: 0px 15px; font-size:small; font-size:50%">' 
                                            + '<a href=' + htmlPath + '?search=' + data[1].MinerPayoutAddress + '>' 
                                            + data[1].MinerPayoutAddress + '</td>'
                                    + '</tr>'
                                    + '<tr>'
                                        + '<td style="height: 30px; padding: 0px 15px; font-size:small">Miner arbitrary data:</td>'
                                        + '<td style="height: 30px; padding: 0px 15px; font-size: 60%">' + data[1].MinerArbitraryData.slice(0,50) + '...</td>'
                                    + '</tr>'
                                    + '<tr>'
                                        + '<td style="height: 30px; padding: 0px 15px; font-size:small">Difficulty:</td>'
                                        + '<td style="height: 30px; padding: 0px 15px; font-size:small">' + difficulty + '</td>'
                                    + '</tr>'
                                    + '<tr>'
                                        + '<td style="height: 30px; padding: 0px 15px; font-size:small">Hashrate:</td>'
                                        + '<td style="height: 30px; padding: 0px 15px; font-size:small">' + hashrate + '</td>'
                                    + '</tr>'
                                    + '<tr>'
                                        + '<td style="height: 30px; padding: 0px 15px; font-size:small">Coins in circulation:</td>'
                                        + '<td style="height: 30px; padding: 0px 15px; font-size:small">' + totalCoins + '</td>'
                                    + '</tr>'
                                    + '<tr>'
                                        + '<td style="height: 30px; padding: 0px 15px; font-size:small">Historic TX count:</td>'
                                        + '<td style="height: 30px; padding: 0px 15px; font-size:small">' + data[1].TransactionCount + '</td>'
                                    + '</tr>'
                                    + '<tr>'
                                        + '<td style="height: 30px; padding: 0px 15px; font-size:small">Historic contracts count:</td>'
                                        + '<td style="height: 30px; padding: 0px 15px; font-size:small">' + data[1].TotalContractCount + '</td>'
                                    + '</tr>'
                                    + '<tr>'
                                        + '<td style="height: 30px; padding: 0px 15px; font-size:small">Historic contracts size:</td>'
                                        + '<td style="height: 30px; padding: 0px 15px; font-size:small">' + contractSize + '</td>'
                                    + '</tr>'
                                    + '<tr>'
                                        + '<td style="height: 30px; padding: 0px 15px; font-size:small">Historic contracts cost:</td>'
                                        + '<td style="height: 30px; padding: 0px 15px; font-size:small">' + contractCost + '</td>'
                                    + '</tr>'
                                    + '<tr>'
                                        + '<td style="height: 30px; padding: 0px 15px; font-size:small">Historic revisions:</td>'
                                        + '<td style="height: 30px; padding: 0px 15px; font-size:small">' + data[1].FileContractRevisionCount + '</td>'
                                    + '</tr>'
                                    + '<tr>'
                                        + '<td style="height: 30px; padding: 0px 15px; font-size:small">Historic storage proofs:</td>'
                                        + '<td style="height: 30px; padding: 0px 15px; font-size:small">' + data[1].StorageProofCount + '</td>'
                                    + '</tr>'
                                    + '<tr>'
                                        + '<td style="height: 30px; padding: 0px 15px; font-size:small">Active contract count:</td>'
                                        + '<td style="height: 30px; padding: 0px 15px; font-size:small">' + data[1].ActiveContractCount + '</td>'
                                    + '</tr>'
                                    + '<tr>'
                                        + '<td style="height: 30px; padding: 0px 15px; font-size:small">Active contract size (est.):</td>'
                                        + '<td style="height: 30px; padding: 0px 15px; font-size:small">' + activeContractSize + '</td>'
                                    + '</tr>'
                                    + '<tr>'
                                        + '<td style="height: 30px; padding: 0px 15px; font-size:small">Active contract cost:</td>'
                                        + '<td style="height: 30px; padding: 0px 15px; font-size:small">' + activeContractCost + '</td>'
                                    + '</tr>'
                                    + '<tr>'
                                        + '<td style="height: 30px; padding: 0px 15px; font-size:small">Contracts in block:</td>'
                                        + '<td style="height: 30px; padding: 0px 15px; font-size:small">' + data[1].NewContracts + '</td>'
                                    + '</tr>'
                                    + '<tr>'
                                        + '<td style="height: 30px; padding: 0px 15px; font-size:small">Transactions in block:</td>'
                                        + '<td style="height: 30px; padding: 0px 15px; font-size:small">' + data[1].NewTx + '</td>'
                                    + '</tr>'
                                + '</thead>'
                            + '</table>'
                        + '</div>'
                    + '</div>'
                + '</div>'

            div.innerHTML = tableCode
            document.getElementById('content2').appendChild(div);

            // Re-adjustements of the layout
            document.getElementById("loader2").style.display = 'none';
            adjustWidth()
        }
    })

    function renderAddressList(txs, auxblock, container, unconfirmedTxs) {
        // Shows the list of changes in balance for a particular address
        var div = document.createElement('div');
        div.className = 'row';
        
        var tableCode = '<table id="table-fill" class="table-outer" style="width: 1150px">' 
            + '<thead>'
                + '<tr>'
                    + '<th colspan="6" class="text-left">'
                        + '<span style="vertical-align:center; margin: 0px 0px 0px 5px"><strong><font size="3">Last 100 transactions:</font></strong></span>'
                    + '</th>'
                + '</tr>'
        

        // Unconfirmed transactions
        if (unconfirmedTxs != null) {
            for (var i = 0; i < unconfirmedTxs.length; i++) {
                var typeAndIcon = txTypeIconAndText(unconfirmedTxs[i].TxType)
                var type = typeAndIcon[0]
                var icon = typeAndIcon[1]

                if (unconfirmedTxs[i].SfValue != 0) {
                    var value = unconfirmedTxs[i].SfValue + " SF"
                    if (unconfirmedTxs[i].SfValue > 0) {var color = "purple"}
                    else {var color = "orange"}
                } else {
                    var value = readable(unconfirmedTxs[i].ScValue) + " SC"
                    if (unconfirmedTxs[i].ScValue > 0) {
                        var color = theme.darkGreen
                    } else {
                        var color = theme.brightRed
                    }
                }

                tableCode = tableCode + '<tr style="height: 40px">'
                        + '<td style="border-right: 0px">'
                            + '<svg style="width: 25px; height: 25px"><use xlink:href="#' + icon + '-text" class="icon-text"/></svg>'
                        + '<td style="padding: 0px 0px 0px 10px; border-right: 0px; font-size:small">' + type + '</td>'
                        + '<td style="font-size:x-small; border-right: 0px"></td>'
                
                // Date only added in wide and medium screens
                if ($(window).width() >= 800) {
                    tableCode = tableCode + '<td style="font-size:small; border-right: 0px">' + timeConverter(unconfirmedTxs[i].Timestamp) + '</td>'
                }

                tableCode = tableCode
                        + '<td style="border-right: 0px; min-width: 150px">'
                            + '<span style="vertical-align:center; font-size:small; padding: 0px 25px; margin: 0px; background:' + theme.red + '; border-radius: 10px; color: ' + theme.black + '; font-weight: 700;">'
                                + 'Unconfirmed</span></td>'
                        + '<td style="border-right: 0px; min-width: 115px; padding: 0px 10px 0px 0px; font-size:small; color: ' + color + '; font-weight: bold; text-align: right">'
                                + value
                        + '</td>'
                    + '</tr>'
            }
        }
        

        // Iterates on each transaction
        for (var n = 0; n < txs.length; n++) {
            var typeAndIcon = txTypeIconAndText(txs[n].TxType)
            var type = typeAndIcon[0]
            var icon = typeAndIcon[1]
            
            if (txs[n].SfChange != 0) {
                var value = txs[n].SfChange + " SF"
                if (txs[n].SfChange > 0) {var color = "purple"}
                else {var color = "orange"}
            } else {
                var value = readable(txs[n].ScChange) + " SC"
                if (txs[n].ScChange > 0) {
                    var color = theme.darkGreen
                } else {
                    var color = theme.brightRed
                }
            }

            // Confirations
            var confirmations = auxblock[0].consensusblock - txs[n].Height + 1
            var colorConfirmation = ""
            if (confirmations < 10) {
                colorConfirmation = theme.yellow
            } else if (confirmations >= 10 && confirmations < 72) {
                colorConfirmation = theme.lime
            } else {
                colorConfirmation = theme.accent
                confirmations = "72+"
            }

            tableCode = tableCode
            + '<tr style="height: 40px">'
                    + '<td style="border-right: 0px">'
                        + '<svg style="width: 25px; height: 25px"><use xlink:href="#' + icon + '-text" class="icon-text"/></svg>'
                    + '<td style="padding: 0px 0px 0px 10px; border-right: 0px; font-size:small"><a href=' + htmlPath + '?search=' + txs[n].MasterHash + '>' + type + '</a></td>'
                    + '<td style="font-size:x-small; border-right: 0px"><a href=' + htmlPath + '?search=' + txs[n].MasterHash + '>'
                        + superShortHash(txs[n].MasterHash) + '</a></td>'
            
            // Date only added in wide and medium screens
            if ($(window).width() >= 800) {
                tableCode = tableCode
                    + '<td style="font-size:small; border-right: 0px"><a href=' + htmlPath + '?search=' + txs[n].MasterHash + '>'
                        + timeConverter(txs[n].Timestamp) + '</a></td>'
            }

            tableCode = tableCode
                    + '<td style="border-right: 0px; min-width: 150px"><a href=' + htmlPath + '?search=' + txs[n].MasterHash + ' style="display:block;">'
                        + '<span style="vertical-align:center; font-size:small; padding: 0px 15px; margin: 0px; background: ' + colorConfirmation + '; border-radius: 10px; color: ' + theme.black + '; font-weight: 700;">'
                            + confirmations + ' confirmations'
                        + '</span></a>'
                    + '</td>'
                    + '<td style="border-right: 0px; min-width: 115px; padding: 0px 10px 0px 0px; font-size:small; color: ' + color + '; font-weight: bold; text-align: right">'
                            + value
                    + '</td>'
                + '</tr>'
        }
        
        // This closes the table
        tableCode = tableCode + '</thead> </table>'
        div.innerHTML = tableCode
        document.getElementById(container).appendChild(div);
        document.getElementById(container).style.display = 'block'

        // Re-adjustements of the layout
        document.getElementById("loader2").style.display = 'none';
        adjustWidth()
    }

    function txTypeIconAndText(txType) {
        // Tx type label and icon
        if (txType == "ScTx") {
            var type = "Siacoin transfer"
            var icon = "sctx"
        } else if (txType == "SfTx") {
            var type = "Siafund transfer"
            var icon = "sftx"
        } else if (txType == "SfClaim") {
            var type = "SF dividend claim"
            var icon = "sfclaim"
        } else if (txType == "blockreward") {
            var type = "Block reward"
            var icon = "miner"
        } else if (txType == "storageproof") {
            var type = "Storage proof"
            var icon = "storageproof"
        } else if (txType == "allowancePost") {
            var type = "Allowance posting"
            var icon = "allowance"
        } else if (txType == "collateralPost") {
            var type = "Collateral posting"
            var icon = "collateral"
        } else if (txType == "contractresol") {
            var type = "Contract resolution"
            var icon = "contractresol"
        } else if (txType == "revision") {
            var type = "Contract revision"
            var icon = "revision"
        } else if (txType == "contract") {
            var type = "Contract formation"
            var icon = "contract"
        } else if (txType == "host ann") {
            var type = "Host announcement"
            var icon = "hostann"
        } else if (txType == "contractform") {
            var type = "Contract formation"
            var icon = "contract"
        }
        return [type, icon]
    }

    function renderOutputsList(txs, auxblock, searchQuery) {
        // Renders a button for showing the list of outputs, if pressed it will load a table
        var button = '<div class="adjustable" style="width: 1150px; margin: 0px auto; padding: 0px auto">'
                + '<button type="submit" onclick="loadoutputs(searchQuery) name="find_outputs" style="width: 320px; border-radius: 7px; height: 35px; float: left; font-size: 16px">'
                    + 'Show unspent outputs of this address'
                    + '<br> ' + '</button>'
            + '</div>'
        document.getElementById("content3").innerHTML = button;
        document.getElementById("content3").setAttribute("style","height:125px");
        document.getElementById("content3").style.display = 'block'
        document.getElementById("content3").addEventListener("click", loadoutputs);

        function loadoutputs() {
            // Makes an APi call to the unspent_outputs endpoint
            document.getElementById("content3").innerHTML = '<div style="position: absolute; left: 50%; margin-left: -85.5px; margin-top: 50px">'
                    + document.getElementById("loader").innerHTML
                + '</div><div style="margin: 0px auto; max-width: 1150px; min-width: 550; font-size: 120%; color: ' + theme.boxHeaders + '; font-style: italic; text-align: center">This can take a while, be patient</div>'
            document.getElementById("content3").setAttribute("style","height: 300px");
            
            var jsonPath = apiPath + '/unspent_outputs/' + searchQuery
            $.getJSON(jsonPath, function(outputs) {
                
                // Table of outputs
                var tableOutputs = '<div class="adjustable" style="width: 1150px; margin: 0px auto; padding: 0px auto">'
                    + '<table id="table-fill" class="table-outer">' 
                        + '<thead>'
                            + '<tr>'
                                + '<th colspan="2" class="text-left">'
                                    + '<span style="vertical-align:center; margin: 0px 0px 0px 5px"><strong><font size="3">Unspent outputs</font></strong></span>'
                                + '</th>'
                            + '</tr>'
                if (outputs.length == 0) {
                    tableOutputs = tableOutputs + '<tr style="height: 40px"><td style="padding: 0px 0px 0px 20px; border-right: 0px; font-size:14px">No unspent outputs found</td>'
                        + '<td>-</td></tr>'
                } else {
                    for (var i = 0; i < outputs.length; i++) {
                        tableOutputs = tableOutputs + '<tr style="height: 40px"><td style="padding: 0px 0px 0px 20px; border-right: 0px; font-size:11px">'
                            + '<a href=' + htmlPath + "?search=" + outputs[i].output + '><code>' + outputs[i].output + '</code></a></td>'
                            + '<td style="padding: 0px 10px 0px 0px; font-size:small; font-weight: bold; text-align: right">' + readable(outputs[i].hastings) + ' SC</td></tr>'
                    } 
                }
                
                var tableOutputs = tableOutputs + "</thead></table></div>"
                
                document.getElementById("content3").removeEventListener("click", loadoutputs)
                document.getElementById("content3").setAttribute("style","height: auto");
                document.getElementById("content3").innerHTML = tableOutputs
                adjustWidth()
            })
        }
    }


    function renderCsvDownloadBox(addressesArray, contentBox) {
        // Renders a box for requesting a CSV, and handles the download
        var div = document.createElement('div');
        div.className = 'row';
        var boxCode = '<div class="home-outer">'
                + '<button class="collapsible collapsible1 home-inner">'
                    + '<div style="width: 70px; float: left; font-size: 24pt; padding: 3px 0px 0px 10px">'
                        + '<i class="fa fa-download"></i></div>'
                    + '<div style="margin: 7px 0px 5px 85px">'
                        + `<span style="font-size: 12pt; float: left; font-weight: 700; font-family: 'Lato', sans-serif;">`
                            + 'Download the transaction history as a .csv file</span>'
                    + '</div>'
                    + '<div style="width: 70px; float:right; padding: 2px 0px 10px 0px; font-size: 16pt">'
                        + '<div id="arrowCollapsible"><i class="fa fa-chevron-circle-down"></i></div>'
                    + '</div>'
                + '</button>'
                + '<div class="collapsible-content">'
                    + '<div id="options-box" style="padding: 30px 10px">'
                        + '<div>'
                            + '<div style="float: left">Dates range:</div>'
                            + '<div style="float: left; margin: 0px 0px 0px 20px"><input type="date" id="startDate"></div>'
                            + '<div style="float: left; margin: 0px 0px 0px 20px">to</div>'
                            + '<div style="float: left; margin: 0px 0px 0px 20px"><input type="date" id="endDate"></div>'
                        + '</div>'
                        + '<div style="margin: 30px 0px 0px 0px" id="wrongDatesBox"></div>'
                        + '<div style="margin: 50px 0px 30px 0px">'
                            + '<div style="float: left; margin: 0px 25px 0px 0px">Show only incoming transactions <input type="checkbox" id="onlyIncoming"></div>'
                            + '<div style="float: left;">Exchange rates in: '
                                + '<select id="exchangeRatesDropdown" style="float: right; margin: 3px 0px 0px 15px;">'
                                + '<option>USD</option>'
                                + '<option>AUD</option>'
                                + '<option>BTC</option>'
                                + '<option>CAD</option>'
                                + '<option>CHF</option>'
                                + '<option>CNY</option>'
                                + '<option>EUR</option>'
                                + '<option>GBP</option>'
                                + '<option>HKD</option>'
                                + '<option>ILS</option>'
                                + '<option>INR</option>'
                                + '<option>JPY</option>'
                                + '<option>KRW</option>'
                                + '<option>MXN</option>'
                                + '<option>NOK</option>'
                                + '<option>NZD</option>'
                                + '<option>PLN</option>'
                                + '<option>RUB</option>'
                                + '<option>SEK</option>'
                                + '<option>SGD</option>'
                                + '<option>TRY</option>'
                                + '<option>TWD</option>'
                                + '<option>UAH</option>'
                                + '<option>ZAR</option>'
                            + '</select>'
                            + '</div><br>'
                        + '</div><div style="margin: 0px 0px 50px 0px">'
                            + '<button style="padding: 5px 20px;" id="submitCsvRequest">Submit</button>'
                        + '</div>'
                    + '</div>'
                + '</div></div>'

        div.innerHTML = boxCode
        document.getElementById(contentBox).appendChild(div);

        $("#submitCsvRequest").click("click", function() {
            var checkbox = document.getElementById("onlyIncoming").checked
            var currency = $('#exchangeRatesDropdown option:selected').text()
            var startDate = $('#startDate').val();
            var endDate = $('#endDate').val();
            submitCSV(addressesArray, checkbox, currency, startDate, endDate)
        })
        
        
        // Balances box
        var div2 = document.createElement('div');
        div2.className = 'row';
        var boxCode = '<div class="home-outer" style="padding: 20px 0px 0px 0px">'
                + '<button class="collapsible collapsible2 home-inner">'
                    + '<div style="width: 70px; float: left; font-size: 24pt; padding: 3px 0px 0px 10px">'
                        + '<i class="fa fa-bar-chart"></i></div>'
                    + '<div style="margin: 7px 0px 5px 85px">'
                        + `<span style="font-size: 12pt; float: left; font-weight: 700; font-family: 'Lato', sans-serif;">`
                            + 'Check the balance evolution</span>'
                    + '</div>'
                    + '<div style="width: 70px; float:right; padding: 2px 0px 10px 0px; font-size: 16pt">'
                        + '<div id="arrowCollapsible2"><i class="fa fa-chevron-circle-down"></i></div>'
                    + '</div>'
                + '</button>'
                + '<div class="collapsible-content" style="">'
                    + '<div id="options-box2" style="padding: 10px 10px; height: 250px">'
                        + '<div style="padding: 30px 0px">'
                            + '<div style="float: left;">Exchange rates in: '
                                + '<select id="balanceExchangeRatesDropdown" style="float: right; margin: 3px 0px 0px 15px;">'
                                + '<option>USD</option>'
                                + '<option>AUD</option>'
                                + '<option>BTC</option>'
                                + '<option>CAD</option>'
                                + '<option>CHF</option>'
                                + '<option>CNY</option>'
                                + '<option>EUR</option>'
                                + '<option>GBP</option>'
                                + '<option>HKD</option>'
                                + '<option>ILS</option>'
                                + '<option>INR</option>'
                                + '<option>JPY</option>'
                                + '<option>KRW</option>'
                                + '<option>MXN</option>'
                                + '<option>NOK</option>'
                                + '<option>NZD</option>'
                                + '<option>PLN</option>'
                                + '<option>RUB</option>'
                                + '<option>SEK</option>'
                                + '<option>SGD</option>'
                                + '<option>TRY</option>'
                                + '<option>TWD</option>'
                                + '<option>UAH</option>'
                                + '<option>ZAR</option>'
                            + '</select></div>'
                            + '<button style="margin: 1px 0px 0px 50px; padding: 2px 20px;" id="submitBalanceRequest">Submit</button>'
                        + '</div></div>'
                + '</div></div>'

        div2.innerHTML = boxCode
        document.getElementById(contentBox).appendChild(div2);

        $("#submitBalanceRequest").click("click", function() {
            var currency = $('#balanceExchangeRatesDropdown option:selected').text()
            // Loader
            document.getElementById("options-box2").innerHTML = '</div><div class="mini-loader" id="mini-loader" style="margin: 50px auto;"></div>'
            submitBalanceRequest(addressesArray, currency)
        })

                        
        // Makes the collapsible boxes clickable and animated
        collpasibleClick()
    }

    function collpasibleClick() {
        // Collapsible menu actions
        var coll = document.getElementsByClassName("collapsible1");
        var i;
        for (i = 0; i < coll.length; i++) {
            coll[i].addEventListener("click", function() {
                this.classList.toggle("active");
                var content = this.nextElementSibling;
                if (content.style.maxHeight){
                    content.style.maxHeight = null;
                    document.getElementById("arrowCollapsible").innerHTML = '<i class="fa fa-chevron-circle-down"></i>'
                } else {
                    content.style.maxHeight = content.scrollHeight + "px";
                    document.getElementById("arrowCollapsible").innerHTML = '<i class="fa fa-chevron-circle-up"></i>'
                } 
            });
        }
        // Second collapsible menu
        var coll = document.getElementsByClassName("collapsible2");
        var i;
        for (i = 0; i < coll.length; i++) {
            coll[i].addEventListener("click", function() {
                this.classList.toggle("active");
                var content = this.nextElementSibling;
                if (content.style.maxHeight){
                    content.style.maxHeight = null;
                    document.getElementById("arrowCollapsible2").innerHTML = '<i class="fa fa-chevron-circle-down"></i>'
                } else {
                    content.style.maxHeight = content.scrollHeight + "px";
                    document.getElementById("arrowCollapsible2").innerHTML = '<i class="fa fa-chevron-circle-up"></i>'
                } 
            });
        }
    }

    function submitCSV(addressesArray, checkbox, currency, startDate, endDate) {
        var startDate = new Date(document.getElementById('startDate').value).getTime() / 1000
        var endDate = (new Date(document.getElementById('endDate').value).getTime() / 1000) + 86400 // Plus one day
        if (startDate > 0 && endDate > 0) {
            if (endDate > startDate) {
                // Loader
                document.getElementById("options-box").innerHTML = '</div><div class="mini-loader" id="mini-loader" style="margin: 25px auto;"></div>'
                
                var pathPost = apiPath + "/csv-file"
                $.post(pathPost,
                {
                    addresses: addressesArray,
                    onlyIncoming: checkbox,
                    currency: currency,
                    startDate: startDate,
                    endDate: endDate
                },
                function(data,status){
                    if (data.status == "ok") {
                        document.getElementById("options-box").innerHTML = '<i class="fa fa-check-circle" style="color: ' + theme.text + '; font-size: 150%; margin: 0px 20px 0px 0px"></i> File ready - click to download'
                            + '<a href="/csv_reports/' + data.file + '.csv" download="sia_transactions.csv" style="color: ' + theme.black + ';">'
                                + '<span style="margin: 0px 0px 0px 20px; padding: 3px 20px; color: ' + theme.black + '; background-color: ' + theme.grey3 + '; border-radius: 10px">Download</span></a>'
                            + '<br><br><br><i class="fa fa-hand-holding-heart" style="color: ' + theme.text + '; font-size: 150%; margin: 0px 20px 0px 0px"></i> Was this useful? Please consider leaving a tip'
                            + '<br><code style="font-size: 11px; margin: 0px 0px 0px 25px" id="address_donation">' + donationAddress + '</code>'
                            + '<br><span id="copyDonation" style="margin: 5px 0px 0px 25px; padding: 0px 10px; color: ' + theme.black + '; background-color: ' + theme.grey3 + '; border-radius: 7px; font-size: 80%; cursor: pointer">'
                                + 'Copy</span></a>'

                        $("#copyDonation").click("click", function() {
                            var range = document.createRange();
                            range.selectNode(document.getElementById("address_donation"));
                            window.getSelection().removeAllRanges(); // clear current selection
                            window.getSelection().addRange(range); // to select text
                            document.execCommand("copy");
                        })
                    } else {
                        document.getElementById("options-box").innerHTML = '<i class="fa fa-times-circle" style="color: ' + theme.text + '; font-size: 150%; margin: 0px 20px 0px 0px"></i> Error generating the file. Try again later'
                    }
                });

            } else {
                document.getElementById("wrongDatesBox").innerHTML = '<span style="color: ' + theme.brightRed + '; position: relative; left: 320px; font-size: 80%">Needs to be posterior</span></div>'
            }
        } else if (endDate > 0) {
            document.getElementById("wrongDatesBox").innerHTML = '<span style="color: ' + theme.brightRed + '; position: relative; left: 110px; font-size: 80%">Wrong format</span>'
        } else if (startDate > 0) {
            document.getElementById("wrongDatesBox").innerHTML = '<span style="color: ' + theme.brightRed + '; position: relative; left: 320px; font-size: 80%">Wrong format</span></div>'
        } else {
            document.getElementById("wrongDatesBox").innerHTML = '<span style="color: ' + theme.brightRed + '; position: relative; left: 110px; font-size: 80%">Wrong format</span>'
                + '<span style="color: ' + theme.brightRed + '; position: relative; left: 240px; font-size: 80%">Wrong format</span></div>'
        }
    }

    function submitBalanceRequest(addressesArray, currency) {
        var pathPost = apiPath + "/balance-track"
        $.post(pathPost,
        {
            addresses: addressesArray,
            currency: currency,
        },
        function(data,status){
            if (data.status == "ok") {
                if (data.scDataBool == true && data.sfDataBool == true) {
                    // Add a switch button between SC and SF
                    var switchPosistion = ($('#options-box2').width() / 2) - 65
                    document.getElementById("options-box2").innerHTML = '<div style="position: relative">' 
                        + '<div id="containerChartBalance" style="padding: 0px, 25px"></div>'
                        + '<div style="position: absolute; top: 0px; left: ' + switchPosistion + '">'
                            + '<button id="scBalanceSwitch" style="border-radius: 10px 0px 0px 10px; border: 3px solid ' + theme.text 
                                + '; background-color: ' + theme.accentFaded1 + '; color: ' + theme.text + '; padding: 0px 20px; cursor: pointer; font-weight: 700">SC</button>'
                            + '<button id="sfBalanceSwitch" style="border-radius: 0px 10px 10px 0px; border: 3px solid ' + theme.text 
                                + '; background-color: ' + theme.accentFaded1 + '; color: ' + theme.text + '; padding: 0px 20px; cursor: pointer; font-weight: 700">SF</button>'
                        + '</div>'
                    + '</div>'

                    renderBalanceChart("SC", currency, data.scJson, data.scUsdJson) // Default rendering
                    $("#scBalanceSwitch").click("click", function() {
                        renderBalanceChart("SC", currency, data.scJson, data.scUsdJson)
                    })
                    $("#sfBalanceSwitch").click("click", function() {
                        renderBalanceChart("SF", currency, data.sfJson, data.sfUsdJson)
                    })
                } else {
                    document.getElementById("options-box2").innerHTML = '<div id="containerChartBalance" style="padding: 0px, 25px"></div>'
                }

                if (data.scDataBool == true && data.sfDataBool == false) {
                    renderBalanceChart("SC", currency, data.scJson, data.scUsdJson) // Default rendering
                } else if (data.scDataBool == false && data.sfDataBool == true) {
                    renderBalanceChart("SF", currency, data.sfJson, data.sfUsdJson) // Default rendering
                }

            } else {
                document.getElementById("options-box2").innerHTML = '<i class="fa fa-times-circle" style="color: #555; font-size: 150%; margin: 0px 20px 0px 0px"></i> Error generating the chart. Try again later'
            }
        });
    }

    function renderBalanceChart(coin, currency, json1, json2) {
        // Draw chart
        $('#containerChartBalance').highcharts({
            chart: {
                height: 250,
                spacingTop: 35,
                zoomType: 'x',
                backgroundColor: theme.accentFaded1,
                resetZoomButton: {
                    theme: {display: 'none'}
                }
            },
            title: {text: ''},                                             
            colors: [theme.white, theme.grey3],
            xAxis: {
                type: 'datetime',
                style: {fontSize: '120%'},
                crosshair: {
                    color: "#fff"
                },
                lineColor: theme.white,
                labels: {
                    style: {
                        color: theme.white
                    }
                }
            },
            yAxis: [{
                maxPadding: 0,
                floor: 0,
                title: {
                    text: coin,
                    style: {
                        color: theme.white
                    }
                },
                gridLineColor: theme.white,
                labels: {
                    style: {
                        color: theme.white
                    }
                }
            },{
                maxPadding: 0,
                floor: 0,
                title: {
                    text: currency,
                    style: {
                        color: theme.white
                    }
                },
                gridLineColor: theme.white,
                opposite: true,
                labels: {
                    style: {
                        color: theme.white
                    }
                }
            }],
            tooltip: {
                backgroundColor: theme.grey1,
                borderWidth: 0,
                borderRadius: 10,
                style: {color: theme.grey4},
                shared: true
            },
            legend: {enabled: false},
            plotOptions: {
                area: {
                    fillOpacity: 0,
                    marker: {
                        radius: 1
                    },
                    lineWidth: 3,
                    states: {
                        hover: {
                            lineWidth: 2
                        }
                    },
                    threshold: null
                }
            },
            credits:{enabled:false},
            series: [{
                type: 'area',
                name: coin + ' balance',
                data: json1
            },{
                type: 'area',
                name: currency + " balance (from " + coin + ")",
                data: json2,
                yAxis: 1
            }]
        });
    }

    
    function readable(number) {
        // Transforms numbers into readable: significant decimal digits, 3-digit separators
        number = number / 1000000000000000000000000
        var original = number
        if (number < 0) {
            number = Math.abs(number)
            var sign = "-" // To add at the end
        } else {
            var sign = ""
        }
        integer = Math.floor(number)
        decimal = number - integer
        
        // The decimals
        if (Math.abs(original) < 1) {
            decimal = decimal.toFixed(4)
            decimal = decimal.slice(2)
            if (decimal == 10000) {
                decimal = "00"
                integer++
            }
        }
        else {
            decimal = decimal.toFixed(2) * 100
            decimal = decimal.toFixed(0)
            if (decimal < 10) {decimal = "0" + decimal} // Avoids a 0.05 to be presented as 0.5
            if (decimal == 100) { // Avoids that 1.99 becomes 1.100
                decimal = "00"
                integer++
            }
        }
        
        // Segmenting the integer part
        numTxt = integer.toString()
        var segments = []
        while (numTxt.length > 3) {
            var s = numTxt.slice(-3)
            segments.push(s)
            numTxt = numTxt.slice(0,(numTxt.length-3))
        }
        segments.push(numTxt)
        var readableNumber = ""
        for (var n = (segments.length - 1); n >= 0; n--) {
            readableNumber = readableNumber + segments[n]
            if (n > 0) {readableNumber = readableNumber + " "}
        }

        readableNumber = sign + readableNumber + "." + decimal
        return readableNumber
    }

    function shortHash(hash) {
        if ($(window).width() < 800) {
            hash = hash.slice(0, 40) + "..."
        }
        return hash
    }

    function superShortHash(hash) {
        if ($(window).width() < 1200) {
            hash = hash.slice(0, 15) + "..."
        }
        return hash
    }

    function processSynonyms(synonyms) {
        // Separates the 2 hashes with a blank space after the ","
        var string1 = synonyms.slice(0,64)
        var string2 = synonyms.slice(65)
        // If the sliced string is long, slice it again, as there are 3 hashes in total
        if (string2.length > 100) {
            string3 = string2.slice(65)
            string2 = string2.slice(0,64)
            var concat = string1 + ", " + string2 + ", " + string3
        } else {
            var concat = string1 + ", " + string2
        }
        return concat
    }

    function timeConverter(UNIX_timestamp){
        var a = new Date(UNIX_timestamp * 1000);
        var months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
        var year = a.getFullYear();
        var month = months[a.getMonth()];
        var date = a.getDate();
        var hour = a.getHours();
        if (hour < 10) {hour = "0" + hour}
        var min = a.getMinutes();
        if (min < 10) {min = "0" + min}
        var sec = a.getSeconds();
        if (sec < 10) {sec = "0" + sec}
        var time = date + ' ' + month + ' ' + year + ' - ' + hour + ':' + min + ':' + sec ;
        return time;
    }


function adjustWidth() {
    // Script for adjusting the main page to the screen width. Screens with <1200 will use 1 column
    var w = $(window).width();

    // Adjusting the card sizes to the screen size. More than 850: wider columns
    if (w < 1200 && w >= 800) { // Wide 1 column
        $('.home-inner').css('width', 750);
        $('.home-inner2').css('width', 750);
        $('.adjustable').css('width', 750);
        $('.home-outer').css('width', 800);
        $('.footer').css('max-width', 800);
        $('.sub-header').css('width', 750);
        $('.result').css('width', 750);
        $('.table-outer').css('max-width', 750);
        $('.arrow2').css('min-width', 50)
        $('.inner-header').css('max-width', 690);
        $('.search-box-outer').css('width', 750);
        $('.tab').css('width', 750)
        $('.search-box').css('max-width', 650);
        $('.textbox').css('max-width', 650);
        $('.disclaimer').css('max-width', 750);
        $('.statCardOuter').css('width', "50%")
        $('.statCardOdd').css('margin', "0 25 0 0")
        $('.statCardEven').css('margin', "0 0 0 25")
        $('.cardsRow').css('max-width', 750)
        $('.cardsRow').css('height', "300")
        $('#txListContainer').css('margin', "0 0 1050 0")
        $('#card-qr').css('padding', "0 0 0 75")
    } else if (w < 850) { // 1 column
        $('.home-outer').css('width', 550);
        $('.sub-header').css('width', 550);
        $('.adjustable').css('width', 550);
        $('.result').css('width', 550);
        $('.footer').css('max-width', 550);
        $('.table-outer').css('max-width', 550)
        $('.address-box').css('max-width', 400)
        $('.address-box-inner').css('max-width', 350)
        $('.inner-header').css('max-width', 500);
        $('.qr-code').css('width', 550);
        $('.table-address').css('width', 550);
        $('.search-box-outer').css('width', 550);
        $('.tab').css('width', 550);
        $('.search-box').css('max-width', 450);
        $('.textbox').css('max-width', 450);
        $('.disclaimer').css('max-width', 550);
        $('.collapsible').css('width', 550);
        $('.statCardOuter').css('width', "50%")
        $('.statCardOdd').css('margin', "0 25 0 0")
        $('.statCardEven').css('margin', "0 0 0 25")
        $('.cardsRow').css('max-width', 550)
        $('.cardsRow').css('height', "300")
        $('#txListContainer').css('margin', "0 0 1050 0")
        $('#card-qr').css('padding', "0 0 0 75")
    }

    if (w < 1200) {
        $('.home-inner2').css('height', 360);                                    
    }
}

function resizeArrow() {
    // Simplifies the arrow of the scheme on small screens
    var w = $(window).width();
    if (w < 1200) {
        document.getElementById("arrow").style.display = 'none'
        //document.getElementById("arrow2").style.width = 'none'
    }    
}

adjustWidth()

// Document ready
$(document).ready(function() {
    // Footer
    document.getElementById("footer").innerHTML = "<a href=" + githubRepository
        + " style='color: " + theme.black + "; text-decoration: none'><i class='fa fa-github' style='font-size:32px; color: " + theme.footerText + "'></i><a/>"
});  
