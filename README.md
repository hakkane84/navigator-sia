# navigator-sia
An advanced blockchain explorer for the Sia network, built on Node.js + SQL

![Capture](https://github.com/hakkane84/navigator-sia/blob/master/Capture.JPG)

## General disclaimer
While I have done my best to make the code reliable and easy to understand with multiple comments, I need to clarify I am not a professional programmer. As such, it is entirely possible that I haven’t followed good coding practices or conventions. Also, this is the first public repository I open. Considering these aspects, I apologize in advance for possible rough edges and parts of the code difficult to understand or unoptimized. Speaking clearly. the code will look ugly, but in my hands,  it works as expected. Also, do not expect constant updates on the go as I correct stuff or add features. However, from time to time I will try to update this repository with the most updated build.

## Description and components
Navigator is a complete blockchain explorer solution for the Sia decentralized storage network. It includes advanced capabilities like discerning types of transactions depending on their finality, checking merged balances of up to 1000 addresses or file contract analysis for hosts for up to 1000 simultaneous contracts.

Navigator is the technology that powers https://siastats.info/navigator

It is composed by the following 3 elements:

* A blockchain indexer that collects information from API calls to Sia, processes them and saves them to an SQL database. It performs both the initial indexing task and real-time indexing of new blocks added to the blockchain. It is initialized in the file `navigator.js`
* A RESTful server with multiple endpoints that executes queries to the SQL database, processes them and serves them to the user as a JSON object. It is initialized in the file `modules/restserver.js`
* A single-page web frontend that collects the user request, makes API calls and visualizes the returned JSON in a user-friendly fashion. The visualization is customized for the type of blockchain object queried. It is optional to use, and it is contained on the `web/` folder

## Technical details
At a low level, Navigator applies some basic blockchain consensus rules that are not “hardcoded” directly into the blockchain as transactions. This includes calculating the claimed dividend a Siafund sender is entitled after a transaction or assigning funds to the corresponding addresses after a failed contract where the storage proof was not provided. Thanks to this, Navigator is tracking correctly every single Hasting moving on the network, to the best of my knowledge.

Most of the transactions initiated by a user in Sia are composed by 2 or 3 chained transactions on the blockchain. To improve the user experience, so when they see a transaction in the blockchain they see both a sender address they are familiar with and the final receiver of it, Navigator merges them into a single TX with 2 (or 3 in the case of SF transactions) “synonym hashes”, all of them showing the same view if queried. The intermediate recipient of the first address (that acts as sender in the second) is omitted to simplify the view of the operation. 

There are 2 exceptions to this “merging”. In file contract formations the first 2 TX are called “Allowance posting” and “Collateral posting” while the 3rd one is called “Contract formation”. In Proofs of Storage the first TX is called “Proof of Storage” while the second is called “Contract resolution”.

## Requirements
*	Microsoft SQL Server installed and running on start. Mixed logging to the database is recommended. Credentials for a user with read and write permissions. While SQL Server is a paid product, remember that MS offers the full-featured Developer Edition available for free.
*	An SQL management software, as SQL Server Management Studio (SSMS), bundled as an optional installation of SQL Server
*	Sia software running and synchronized with the network
*	The explorer module of Sia enabled, with its database synchronized. This requirement will be dropped on a future update of Navigator
*	Node.js installed

The following node NMP modules dependencies manually installed:
*	`Sia.js`
*	`mssql`
*	`express`
*	`body-parser`
*	`morgan`
*	`forever` is optional but highly recommended

For the website frontend to work properly (not necessary if only the API server is going to be used): 
*	SSL-secured server
*	SSL private key and certificate placed on `modules/ssl_certificate/`. Configure the variables at `credentials` on `modules/restserver` accordingly
*	CORS enabled on the webserver

## Installation
* Create a new SQL database, with the name `navigator`. Authorize a new user in this database with write and read permission. I recommend SSMS for these tasks
*	Change SQL credentials at the `sqlLogin` array both in `navigator.js` and `modules/sqlfunctions.js`
*	Initialize the tables of the database using the SQL scripts at `tools/create_tables.sql` I recommend SSMS for this. Add manually some extra Indexes to the columns of each tableas indicated on the comments of the script
*	Replace the path of the Node.js dependencies (with the place where you installed them )at the beginning of each `.js` file (both `navigator.js` and the scripts at `/modules`)
*	For the website frontend to work, replace in `/web/navigator.html` the value of the `apiPath` variable with the global path of your API server instead of localhost (by default, it is set up as “https://localhost:3500/navigator-api”)
*	Add SSL key and credential on the folder `modules/ssl_certificate`. Change the path of these files in `modules/restserver.js`
*	If during the initial indexing the script is unable to index a specific block multiple times, add its number at the `blocksToSkip` array in `navigator.js`

## Usage 
Launch `navigator.js` on the command line, preferentially using Forever (`forever start navigator.js`, logs will be saved to a file, check the `forever` documentation) as it is not infrequent that the script crashes. If not launched trough Forever, the script will have to be -reinitiated manually.

Launch `modules/restserver.js` on the command line, preferentially using Forever (`forever start modules/navigator.js`)

The initial indexing will start immediately, and the API server will become available in port 3500. Queries to the database are performed through API calls (either GET or POST). The JSON responses consists on an array of multiple objects. The type of object depends on the specific endpoint called, and on the type of hash when the `/hash/:hash` call is executed. Refer to the following figure to understand the outcome of each call:

![API scheme](https://github.com/hakkane84/navigator-sia/blob/master/API_scheme1.JPG)
![API scheme2](https://github.com/hakkane84/navigator-sia/blob/master/API_scheme2.JPG)

An optional website frontend is available on /web. Deploy its contents on your favorite webserver (IIS, XAMPP…). A complete working frontend (with custom CSSs) can be found at http://siastats.info/navigator . Remember to change the variable `apiPath` on `web/navigator.html` to make it available externally. Navigator can only be accessed externally in a website secured by SSL, with its keys and certificates placed on `modules/ssl_certificate/`.


## Bundled tools
*	`/tools/create_tables.sql` : Initializes the tables for a database. Don’t forget to manually add indexes to the columns indicated on the comments of the file
*	`/tools/delete_contents.sql` : Deletes ALL the information contained on the tables of the database
*	`/tools/delete_from_block.sql` : Deletes the contents of a database starting on the specified block and upwards. Useful if you think recent information has been miss-indexed. Customize the height of the block on each of the 8 lines of the script
*	`/tools/navigator_gap_repair.js` : Deletes and re-indexes the block (or blocks) specified on the `blocks` variable. Invoke in the command line as `node navigator_gap_repair.js`. Useful to repair a specific block

## Future development directions
While already functional, Navigator is a work-in-progress project. Besides correcting the natural bugs that might be found over the months following the release, I am committed to make it evolve in several aspects, including the following:

*	Currently the database is constructed on top of the Sia `explorer/block` API responses. The explorer module of Sia is currently unmaintained and highly prone to crashes and corruption. The fist short-term goal is replacing it by `consenus/block/:height` API calls, while Navigator builds its own block metadata info. In other words: the goal is to replace completely the dependence on explorer
*	To facilitate the deployment and maintenance of the database, SQL Server will be replaced by and embedded database solution as SQLite or SQL Server Compact.
*	In the mid-long term, the whole code will be translated to Golang and implemented as an optional module of Sia. Thus, Navigator could become a module complementary or substitutive of explorer for other Sia infrastructure providers.
