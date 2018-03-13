class PriceAlert {
    constructor(tokenHandle, priceType, price) {
        this.tokenHandle = tokenHandle;
        this.priceType = priceType;
        this.price = price;
    }
}

module.exports = PriceAlert;