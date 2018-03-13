const fetch = require('node-fetch');

class Forkdelta {
    constructor() {
        this.tokens = new Map(); // key: human readable symbol, value: forkdelta handle
        this.symbolLookup = new Map(); // key: lower case symbol for case-insensitive search, value: case
        // sensitive symbol
        this.tradeData = null;
        // get tokens and trade data once and then periodically:
        this.fetchTokenList();
        this.fetchTradeData();
        setInterval(() => {this.fetchTokenList()}, 8640000); // get list of traded tokens every 24 hours
        setInterval(() => {this.fetchTradeData()}, 300000); // get fork delta api data every 5 minutes
    }

    /**
     * get list of traded tokens from https://forkdelta.github.io/config/main.json
     */
    fetchTokenList() {
        // get token list
        fetch('https://forkdelta.github.io/config/main.json')
            .then(response => {
                response.json().then(json => {
                    //this.tokens = json.tokens;
                    this.tokens = new Map();
                    this.symbolLookup = new Map();
                    json.tokens.forEach((token) => {
                        this.tokens.set(token.name, 'ETH_' + token.addr.substring(0, 9));
                        this.symbolLookup.set(token.name.toLowerCase(), token.name);
                    });
                });
            });
    }

    /**
     * get fork delta api data from https://api.forkdelta.com/returnTicker
     */
    fetchTradeData() {
        fetch('https://api.forkdelta.com/returnTicker')
            .then(response => {
                response.json().then(json => {
                    this.tradeData = json;
                });
            });
    }

    /**
     * get a price of a token
     * @param tokenHandle handle of token traded on forkdelta in the form of 'ETH_' + first 9 characters
     * of smart contract address (e.g. 'ETH_0x089a6d8')
     * @param priceType the desired type of price ('last', 'bid' or 'ask') as string
     * @returns {*} the desired price for the token
     */
    getPrice(tokenHandle, priceType) {
        return this.tradeData[tokenHandle][priceType];
    }

    /**
     * get token handle traded on forkdelta by the human readable symbol
     * see https://forkdelta.github.io/config/main.json for list of tokens
     * @param symbol human readable symbol of a token (e.g. 'REP')
     * @returns {string} tokenHandle traded on forkdelta
     */
    getTokenHandleBySymbol(symbol) {
        return this.tokens.get(symbol);
    }

    /**
     * maps the case-insensitive symbol to the appropriate symbol
     * @param symbol case-insensitive
     * @returns {string} case-sensitive symbol
     */
    lookupSymbol(symbol) {
        return this.symbolLookup.get(symbol.toLowerCase());
    }

}

module.exports = Forkdelta;