class PriceAlert {
    constructor(symbol, tokenHandle, priceType, price) {
        this.symbol = symbol;
        this.tokenHandle = tokenHandle;
        this.priceType = priceType;
        this.price = price;
    }
}

module.exports = PriceAlert;