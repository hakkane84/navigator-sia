// Prepares the website files injecting the customized variables from config.json and params.js
var fs = require('fs');

exports.Injector = async function(params) {

    // A1 - Opening the web JS file
    var jsFile = fs.readFileSync(params.websitePath + "/nav_assets/navigator_web.js").toString()

    // A2 - Preparing the variables as a string
    var injection = "var theme = {\n"
            + "\taccent: '" + params.colors.accent + "',\n"
            + "\taccentFaded1: '" + params.colors.accentFaded1 + "',\n"
            + "\taccentFaded2: '" + params.colors.accentFaded2 + "',\n"
            + "\tdecoration: '" + params.colors.decoration + "',\n"
            + "\tdecorationSubtle: '" + params.colors.decorationSubtle + "',\n"
            + "\tdecorationContrast: '" + params.colors.decorationContrast + "',\n"
            + "\tbackground: '" + params.colors.background + "',\n"
            + "\tgreen: '" + params.colors.green + "',\n"
            + "\tdarkGreen: '" + params.colors.darkGreen + "',\n"
            + "\tyellow: '" + params.colors.yellow + "',\n"
            + "\tred: '" + params.colors.red + "',\n"
            + "\tbrightRed: '" + params.colors.brightRed + "',\n"
            + "\tlime: '" + params.colors.lime + "',\n"
            + "\ttext: '" + params.colors.text + "',\n"
            + "\tboxHeaders: '" + params.colors.boxHeaders + "',\n"
            + "\tblack: '" + params.colors.black + "',\n"
            + "\twhite: '" + params.colors.white + "',\n"
            + "\tgrey1: '" + params.colors.grey1 + "',\n"
            + "\tgrey2: '" + params.colors.grey2 + "',\n"
            + "\tgrey3: '" + params.colors.grey3 + "',\n"
            + "\tgrey4: '" + params.colors.grey4 + "',\n"
            + "\tfooterText: '" + params.colors.footerText + "',\n"
            + "\ttableBorders: '" + params.colors.tableBorders + "',\n"
        + "}\n"
        + "var htmlPath = '" + params.htmlPath + "'\n"
        + "var landingRefreshPeriod = " + params.landingRefreshPeriod + "\n"
        + "var donationAddress = '" + params.donationAddress + "'\n"
        + "var githubRepository = '" + params.githubRepository + "'\n"
        + "var useCoinGeckoPrices = " + params.useCoinGeckoPrices + "\n"
    
    // A3 - Replacing the insertion point by the custom variables
    var s = jsFile.search("INJECTION POINT")
    jsFile = injection + jsFile.slice(s-3)

    // A4 - Saving the file
    fs.writeFileSync(params.websitePath + "/nav_assets/navigator_web.js", jsFile)


    // B1 - Opening the web CSS file
    var cssFile = fs.readFileSync(params.websitePath + "/nav_assets/navigator_styles.css").toString()

    // B2 - CSS variables as a string
    var injection = ":root {\n"
            + "\t--accent: " + params.colors.accent + ";\n"
            + "\t--headerBackground: " + params.colors.headerBackground + ";\n"
            + "\t--accentFaded1: " + params.colors.accentFaded1 + ";\n"
            + "\t--accentFaded2: " + params.colors.accentFaded2 + ";\n"
            + "\t--background: " + params.colors.background + ";\n"
            + "\t--tableShadow: " + params.colors.tableShadow + ";\n"
            + "\t--white: " + params.colors.white + ";\n"
            + "\t--black: " + params.colors.black + ";\n"
            + "\t--decoration: " + params.colors.decoration + ";\n"
            + "\t--decorationSubtle: " + params.colors.decorationSubtle + ";\n"
            + "\t--decorationContrast: " + params.colors.decorationContrast + ";\n"
            + "\t--yellow: " + params.colors.yellow + ";\n"
            + "\t--red: " + params.colors.red + ";\n"
            + "\t--brightRed: " + params.colors.brightRed + ";\n"
            + "\t--green: " + params.colors.green + ";\n"
            + "\t--darkGreen: " + params.colors.darkGreen + ";\n"
            + "\t--lime: " + params.colors.lime + ";\n"
            + "\t--text: " + params.colors.text + ";\n"
            + "\t--boxHeaders: " + params.colors.boxHeaders + ";\n"
            + "\t--oddCellsTable: " + params.colors.oddCellsTable + ";\n"
            + "\t--tableBorders: " + params.colors.tableBorders + ";\n"
            + "\t--grey1: " + params.colors.grey1 + ";\n"
            + "\t--grey2: " + params.colors.grey2 + ";\n"
            + "\t--grey3: " + params.colors.grey3 + ";\n"
            + "\t--grey4: " + params.colors.grey4 + ";\n"
            + "\t--grey5: " + params.colors.grey5 + ";\n"
            + "\t--footer: " + params.colors.footer + ";\n"
            + "\t--qrCodeBackground: " + params.colors.qrCodeBackground + ";\n"
            + "\t--qrCode: " + params.colors.qrCode + ";\n"
            + "\t--statCardBorder: " + params.colors.statCardBorder + ";\n"
        + "}"

    // B3 - Replacing colors with custom ones
    var s = cssFile.search("INJECTION POINT")
    cssFile = injection + cssFile.slice(s-6)

    // B4 - Saving file
    fs.writeFileSync(params.websitePath + "/nav_assets/navigator_styles.css", cssFile)

    console.log("* Website ready. Custom variables injected")
}