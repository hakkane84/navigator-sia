# navigator-sia
An advanced blockchain explorer for the Sia network, built on Node.js + SQL.

![Capture](/example_capture.jpg)

## Features

* Full blockchain explorer capabilities
* Simple setup: Only a synced Sia client and Node.js are required. No need to install a database engine, as a self-contained SQLite database is used by
default
* Indexer, database manager, API server and website server contained in the same script. Literally, just launch `navigator.js` and check your IP in a browser
* Transactions made of multiple individual ones in the same block are merged to facilitate the usuer-friendlyness when they query a hash. For example, the submission of an storage proof is usually made of 2 individual transactions. In Navigator both can be searched, and will return the same information, informing the user that both belong to the process of submitting a storage proof
* It follows consensus rules not included on the raw blockchain, as indicating when a contract failed or succeded or the dividend paid to SiaFund holders during a contract formation
* Customized pages for each type of transaction: Host announcements will show the IP announced, contracts will display a timeline of it with its associated revisions and storage proofs...
* Search transactions in bulk to get an overview of a whole Sia wallet. Up to 100.000 addresses can be queried this way
* Search host contracts in bulk to get an overview of the timeline and stats of the contracts. Up to 100.000 contracts can be searched
* Transactions CSV file download and a chart with evolution of the balance for every address or batch of addresses. Amounts converted to 25+ different currencies at the exchange rate of each day
* Easily customizable color theme and branding. All the setup can done altering the `config.json` file

## New on version 2

For final users:
* Dashboard-style landing page. Auto-updated and animated
* Searh transaction outputs by their hash. Also, the search of unspent outputs of an address (previously slow for large addresses) is now out of beta and will work almost instantly even for addresses with thosands of transactions. This will be usueful for developers and users of hardware wallets
* Unconfirmed transactions improved tracking: addresses will show the unconfirmed balance and transactions when searching an address
* CSV file downloads with the transaction history. Charts of the balance evolution for an address or batch of addresses. Amounts transformed to the selected FIAT currency (these features were already available in SiaStats.info, but now are open source too)
* Thanks to the scalability improvements, now you can search up to 100K addresses or contracts in bulk
* Blockchain reorgs recording. There is not yet a UI for this, but reorg events can be checked with the API `/navigator-api/reorgs`
* Multiple bugs corrected

For explorer maintainers:
* The most stable and reliable version of Navigator ever. The Sia `explorer` module is not necessary anymore, what results in more accurate data, no downtime due to critical bugs on the module and setups easier to maintain (by orders of magnitude)
* Ultra-easy setup. No MS SQL Server is required, instead a self-contained SQLite databse is used by default. The blockchain indexer, the API server and the website server (using `express`) are all launched by a single script. Just launch one script and check your IP in a web browser. Literally.
* Easy to customize, including the color theme, ports and options, just editing a `config.json` file
* A "watchdog" routine, together with using `pm2` will guarantee the explorer running unattended
* A UI needs to be developed for this, but Navigator now keeps a database table with the balance of every address on real time


## System minimal requirements

* A Sia client running and fully synced to the blockchain
* `Node.js` installed. Version 10.xx is recommended. Version 12 and onwards are not compatible with some dependencies at the moment of writting this
* The HTTP port (and the HTTPS port if SSL was enabled on the config file) indicated on the config file open to the world in order to access the web frontend (default: `80` for HTTP and `443` for optional HTTPS)
* At least 40GB of disk space available (the database occcupies ~25-30). SSD or NVMe necessary for the database. IOPS of the disk will impact dramatically the speeds of indexing and retrieval of data

## Installation and usage

* `npm install`
* `npm install -g pm2`
* (Optional) Customize ports, web color theme, preferred database engine and many other parameters in the `config.json` file. Just read the comments on the file and follow them
* `pm2 start navigator.js`. The blockchain indexer, the API server and the web server will start immediately. The website frontend will be available on the ports specified on the `config.json` file

The logs of the program can be accessed using `pm2 monit` or `pm2 logs`. For more info about using PM2, check its [documentation site](https://pm2.keymetrics.io/docs/usage/quick-start/). If you make any change to the configuration file, just restart the script with `pm2 restart navigator`.

### Initial indexing

If this is the first startup, the database and tables will be created, and historic coin prices will be retrieved in first place. Once this initial setup is complete, the blockhain indexing will start, and data will become available on the website immediately, showing the syncing status on the landing page.

The initial sync will take approximately 5 days (or longer, depending on your hardware), as of May 2020. Certain parts of the blockchain, more "dense" in transactions, will take considerable longer to index. For example, blocks between 30000 and 150000 will take 4x (or more) longer than recent blocks.

### API

The script serves not only the website and assets, but also a complete API. This section needs detailed documentation, but an overview of most of the endpoints and the structure of the responses can be checked in these schematics:

![API scheme](/api_scheme1.jpg)
![API scheme2](/api_scheme2.jpg)

### Re-indexing the database

If a re-indexing of the blockchain is required (for example, after a code upgrade that changes the outcome of already indexed transactions), a "live reindexing" mode is available. Stop the process handled by pm2 and launch the script in Node followed by the block from which you want to start the re-index. For example `node navigator.js 180000`. In this mode, while Navigator is iddle (waiting for new blocks) it will reindex blocks. Even if the script crashes, the re-indexing will resume where it was left. Once the reindexing is done, you can stop the script and re-start it under `pm2` control.

Alternatively, you can use the tool `/tools/reindexer.js` to order a manual re-indexing of the specified blockchain segment. For example: `node reindexer.js 150000 151000`. The navigator.js main process **needs to be stopped** while using this script if you are using SQLite as database engine (the default).

### Database engine

You can choose between SQLite and MS SQL Server as the database engine. SQLite, the default option, requires zero setup and no installation. It is an embedded and portable database file called `navigator.db`.

If you are already using MS SQL Server, you might prefer to use it instead. For this, just change in the config file the `useMsSqlServer` to `true` and introduce the credentials in the `sqlLogin` object. You will need to create manually the `navigator` database using SSMS.

In terms of performance, both database engines are very similar, where SQL Server performs slightly better only in batch retrieval operations. Unless you have specific reasons to use SQL Sever, I encourage you to use the default choice of SQLite/

### Using or not the `explorer` module of Sia

Navigator can work without enabling the `explorer` module of Sia. However, due to some information missing from the `/consensus` API endpoint of Sia, it is not possible to know the output ID of miner payouts and SiaFund claimed coins. These amounts will show up correctly in Navigator, but when these amounts are spent, the addresses will not show the deducted coins. In other words, if you don't enable the explorer module, every transaction will show correctly, but the balances of SC of mining pools and SF owners will not be accurate. Only these two kinds of wallets (a marginally small percentage of the users) are impacted, the rest of wallets will be accurate.

If you optionally enable the `explorer` Sia module (take in mind it will take on its own ~25GB on your Sia folder) and set to `true` the variable `explorerAvailable` on the config file of Navigator, `/explorer` calls will be used to complete this missing information and show 100% accurate data for these special wallets. Even if the `explorer` module of Sia is deprecated and unstable, Navigator will keep working perfectly, even after the frequent crtical errors of this module. In other words, even if this Sia module is unstable, Navigator will not be impacted and you will not need to perform any additional maintenance.

Once the Sia developers fix the issue [#3791](https://gitlab.com/NebulousLabs/Sia/-/issues/3791), a future update of Navigator will drop this last point where the `explorer` module can be helpful.

## Included tools

Several utilities are included in the `tools` folder. With the exception of `database_query.js`, it is highly recommended to stop the main `navigator.js` script while using them if your database of choice is SQLite:

* `database_query.js`: Will perform a query to your database in SQL language. There are many tools available for this, but this simple tool can give you a fast answer to a query. Example of usage: `node database_query.js SELECT * FROM BlockInfo WHERE Height = 12345`
* `reindexer.js`: Will reindex a block or a segment of blocks. Example: `node reindexer.js 12000 12050`
* `delete_blocks.js`: Will delete the entries in the database of a block or a segment of blocks. Example: `node delete_blocks.js 12000 12050`
* `mining_pools_updater.js`: If a new mining pool is announced and you know its payout address, add an entry to the `poolAddresses.json` file and then apply this tool to assign old "Unknown" blocks to this new pool. It takes the path of the JSON file as an argument
* `database_reset.js`: Deletes ALL the blockchain contents from the database irreversively

## Compatibility with other blockchains and Sia forks

Navigator is a blockchain explorer fully tailored to the Sia blockchain and I will gladly assist any developer aiming to deploy a mirror of it or modify it as long as it remains in the scope of the Sia blockchain. The code will **not** work out of the box for other forks of Sia or blockchains, present or future, and will require extensive modifications due to the many particularities and specificities of each blockchain. Navigator is open source and you are free to try to adapt it to other blockchain, but it will be your full responsability to ensure its accuracy and I will not assist you in this task.

In any case, you are expected to fully respect the GNU AGPLv3 license terms, including (but not limited to) publishing the modified code repository and linking it to your explorer website, as well as preserving the authorship, attribution and license of the code in this repository.

## License

This software was made open source with the aim to facilitate the availability of high-quality Sia blockchain explorer websites. It uses the GNU AGPL v3.0 license, meaning that if you run a modified version of the code in your server, you are demanded to publish its modified code, preserving this same license and the code authorship and attribution. The goal is ensuring the progress and continuous improvement of this codebase as well as the public availability of open source Sia explorers in the future. Please check the License file for full details.

I made really easy to comply with this license: use the clone button of this repository, push changes to your clone and just change the variable `githubRepository` in the `config.json` file. A GitHub icon linking to your repo will be added automatically to the footer of your Navigator website!!