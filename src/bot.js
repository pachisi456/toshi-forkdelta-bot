const Bot = require('./lib/Bot');
const SOFA = require('sofa-js');
const Fiat = require('./lib/Fiat');
const IdService = require('./lib/IdService');
const Forkdelta = require('./Forkdelta');
const PriceAlert = require('./PriceAlert');

let bot = new Bot();
let forkdelta = new Forkdelta();


// ROUTING AND BOT LOGIC:

bot.onEvent = function(session, message) {
    switch (message.type) {
        case 'Init':
            welcome(session);
            break;
        case 'Message':
            onMessage(session, message);
            break;
        case 'Command':
            onCommand(session, message);
            break;
        case 'Payment':
            onPayment(session, message);
            break;
        case 'PaymentRequest':
            sendMessage(session, 'Sorry, I don\'t take requests.');
            break
    }
};

function onCommand(session, command) {
    let symbol;
    switch (command.content.value) {
        case 'cancel':
            sendMessage(session, 'How can I help you?');
            break;
        case 'getPrice':
            sendMessage(session, 'What token do you want to know the price of? Please send me the official symbol.');
            break;
        case 'alerts':
            let userAlerts = session.getGlobal(session.user.username);
            if (userAlerts === undefined) {
                priceAlerts(session, 'You currently don\'t have any price alerts set.');
            } else {
                for (alert in userAlerts) {
                    let humanIndex = +alert + 1; // start counting at 1 instead of 0
                    priceAlerts(session, humanIndex + '. ' + userAlerts[alert].symbol + ': ' +
                        userAlerts[alert].priceType + ' price alert set to ' +
                        userAlerts[alert].price + ' ETH.');
                }
            }
            break;
        case 'setAlert':
            setAlert(session, 'What token do you want to set an alert for? Please send me the official symbol.');
            break;
        case 'bid':
            session.set('priceTypeToSetAlertFor', 'bid');
            symbol = session.get('tokenToSetAlertFor');
            setAlertPrice(session, 'Okay, so you want to set an alert for the bid price of ' + symbol + '. ' +
                'Please provide a price in ETH. If the bid price on ForkDelta drops below this price I will ' +
                'let you know.');
            break;
        case 'ask':
            session.set('priceTypeToSetAlertFor', 'ask');
            symbol = session.get('tokenToSetAlertFor');
            setAlertPrice(session, 'Okay, so you want to set an alert for the ask price of ' + symbol + '. ' +
                'Please provide a price in ETH. If the bid price on ForkDelta rises above this price I will ' +
                'let you know.');
            break;
        case 'info':
            welcome(session);
            break;
        case 'contribute':
            sendMessage(session, 'If you want to request or implement a feature feel free to reach out to ' +
                '@pachisi456. The source code can be found at github.com/pachisi456/toshi-forkdelta-bot. ' +
                'Pull requests with new features will happily be reviewed and accepted.');
            break;
        case 'donate':
            sendMessage(session, 'If you think this work should be rewarded feel free to leave me a small ' +
                'donation via the PAY button above. Thanks a lot!');
            break;
    }
}

async function onMessage(session, message) {
    //TODO make sure every step is handled
    console.log(session.user.username + 'is on step ' + session.get('step'));
    console.log(JSON.stringify(session.getGlobalAll()));
    let symbol;
    let handle;
    switch (session.get('step')) {
        case 'setAlert':
            // translate the case-insensitive user input to first to a case-sensitive symbol and then to the human
            // readable handle
            symbol = forkdelta.lookupSymbol(message.body);
            // check if handle was found and thus is traded on forkdelta
            if (symbol != null) {
                session.set('tokenToSetAlertFor', symbol); // save the token handle for later reference
                setAlertPriceType(session, symbol);
            } else {
                setAlert(session, 'Sorry, I couldn\'t find what you\'re looking for. Please try again.');
            }
            break;
        case 'setAlertPrice':
            // verify that user provided a valid price
            let price = message.body.match(/\d+([.|,]\d+)?/g);
            if (price != null) {
                // create a new alert:
                symbol = session.get('tokenToSetAlertFor');
                handle = forkdelta.getTokenHandleBySymbol(symbol);
                let priceType = session.get('priceTypeToSetAlertFor');
                let alert = new PriceAlert(symbol, handle, priceType, price);

                // get existing alerts, add new alert and write back alerts to global storage
                let userAlerts = session.getGlobal(session.user.username);
                if (userAlerts === undefined) {
                    userAlerts = [alert];
                } else {
                    userAlerts.push(alert);
                }
                session.setGlobal(session.user.username, userAlerts);

                sendMessage(session, 'Alert for ' + symbol + ' ' + priceType + ' price successfully set to ' +
                    price + ' ETH.');
            } else {
                setAlertPrice(session, 'Sorry, I didn\'t get that. Please try again.');
            }
            break;
        default:
            // translate the case-insensitive user input to first to a case-sensitive symbol and then to the human
            // readable handle
            symbol = forkdelta.lookupSymbol(message.body);
            handle = forkdelta.getTokenHandleBySymbol(symbol);
            // check if handle was found and thus is traded on forkdelta
            if (handle != null) {
                let last = forkdelta.getPrice(handle, 'last');
                let bid = forkdelta.getPrice(handle, 'bid');
                let ask = forkdelta.getPrice(handle, 'ask');
                let lastUSD = await convertEthToUSD(last);
                let bidUSD = await convertEthToUSD(bid);
                let askUSD = await convertEthToUSD(ask);
                sendMessage(session, 'Prices for ' + symbol + ':\n' +
                    'last: ' + last + ' ETH ($' + lastUSD.toFixed(2) + ')\n' +
                    'bid: ' + bid + ' ETH ($' + bidUSD.toFixed(2) + ')\n' +
                    'ask: ' + ask + ' ETH ($' + askUSD.toFixed(2) + ')');
            } else {
                sendMessage(session, 'Sorry, I couldn\'t find what you\'re looking for. Please try again.');
            }
            break;
    }
}

function onPayment(session, message) {
    if (message.fromAddress == session.config.paymentAddress) {
        // handle payments sent by the bot
        if (message.status == 'confirmed') {
            // perform special action once the payment has been confirmed
            // on the network
        } else if (message.status == 'error') {
            // oops, something went wrong with a payment we tried to send!
        }
    } else {
        // handle payments sent to the bot
        if (message.status == 'unconfirmed') {
            // payment has been sent to the ethereum network, but is not yet confirmed
            sendMessage(session, `Thanks for the payment! 🙏`);
        } else if (message.status == 'confirmed') {
            // handle when the payment is actually confirmed!
        } else if (message.status == 'error') {
            sendMessage(session, `There was an error with your payment!🚫`);
        }
    }
}


// MESSAGES AND USER INTERACTION:

function welcome(session) {
    sendMessage(session, 'Hi there! I\'m a bot that utilizes the API of ForkDelta, a decentralized Ethereum Token ' +
        'Exchange with the most ERC20 listings of any exchange. You can ask me for prices traded on ForkDelta ' +
        'and set price alerts.');
}

/**
 * notify user about set alert
 * @param session user session to send message to
 * @param symbol of token (e.g. 'REP')
 * @param priceType type of price ('last', 'bid' or 'ask')
 * @param price of that token
 */
function priceNotification(session, symbol, priceType, price) {
    sendMessage(session, 'Price Alert! ' + priceType + ' price of ' + symbol + ' is ' + price + '.');
}

function sendMessage(session, message) {
    session.set('step', 'start');
    let controls = [
        {type: 'button', label: 'Get a price', value: 'getPrice'},
        {type: 'button', label: 'Price alerts', value: 'alerts'},
        {type: 'group', label: 'More', controls: [
                {type: 'button', label: 'Info', value: 'info'},
                {type: 'button', label: 'Contribute', value: 'contribute'},
                {type: 'button', label: 'Donate', value: 'donate'}
            ]}
    ];
    session.reply(SOFA.Message({
        body: message,
        controls: controls,
        showKeyboard: false,
    }));
}

function priceAlerts(session, message) {
    session.set('step', 'alerts');
    let controls = [
        {type: 'button', label: 'Set alert', value: 'setAlert'},
        {type: 'button', label: 'back', value: 'cancel'},
        {type: 'group', label: 'More', controls: [
                {type: 'button', label: 'Info', value: 'info'},
                {type: 'button', label: 'Contribute', value: 'contribute'},
                {type: 'button', label: 'Donate', value: 'donate'}
            ]}
    ];
    session.reply(SOFA.Message({
        body: message,
        controls: controls,
        showKeyboard: false,
    }));
}

function setAlert(session, message) {
    session.set('step', 'setAlert');
    session.reply(SOFA.Message({
        body: message,
        controls: [
            {type: 'button', label: 'Cancel', value: 'cancel'}
        ],
        showKeyboard: true
    }));
}

function setAlertPriceType(session, symbol) {
    session.set('step', 'setAlertPriceType');
    session.reply(SOFA.Message({
        body: 'What price of ' + symbol + ' do you want to set an alert for, bid or ask?',
        controls: [
            {type: 'button', label: 'Bid', value: 'bid'},
            {type: 'button', label: 'Ask', value: 'ask'}
        ],
        showKeyboard: true
    }));
}

function setAlertPrice(session, message) {
    session.set('step', 'setAlertPrice');
    session.reply(SOFA.Message({
        body: message,
        controls: [
            {type: 'button', label: 'Cancel', value: 'cancel'}
        ],
        showKeyboard: true
    }));
}


// HELPERS:

function getAlerts(session) {
    let alerts = session.getGlobalAll();
    delete alerts.address; // clean up to only have the alerts left
    return alerts;
}

function convertEthToUSD(eth) {
    return Fiat.fetch().then((toEth) => {
        let rateUSD = toEth.USD(1);
        return Promise.resolve(eth / rateUSD);
    });
}
