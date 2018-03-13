const Bot = require('./lib/Bot');
const SOFA = require('sofa-js');
const Fiat = require('./lib/Fiat');
const Forkdelta = require('./Forkdelta');

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
    switch (command.content.value) {
        case 'back':
            sendMessage(session, 'How can I help you?');
            break;
        case 'getPrice':
            getPrice(session, 'What token do you want to know the price of? Please send me the official' +
                ' symbol.');
            break;
        case 'setAlarm':
            setAlarm(session, 'This feature will be implemented shortly!');
            break;
        case 'info':
            sendMessage(session, 'ForkDelta Bot makes use of the ForkDelta API to enable users to look up ' +
                'prices traded on ForkDelta and set price alarms.');
            break;
        case 'contribute':
            sendMessage(session, 'If you want to request or implement a feature feel free to reach out to ' +
                '@pachisi456. The source code can be found at github.com/pachisi456/toshi-forkdelta-bot. ' +
                'Pull request with new features will be happily accepted.');
            break;
        case 'donate':
            sendMessage(session, 'If you think this work should be rewarded feel free to leave me a small ' +
                'donation via the PAY button. Thanks a lot!');
            break;
    }
}

async function onMessage(session, message) {
    switch (session.get('step')) {
        case 'start':
            sendMessage(session, 'How can I help you?');
            break;
        case 'getPrice':
            // make message body all caps and translate the symbol to the traded token handle:
            let symbol = forkdelta.lookupSymbol(message.body);
            let handle = forkdelta.getTokenHandleBySymbol(symbol);
            // if handle was found give back prices:
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
                getPrice(session, 'Sorry, I couldn\'t find what you\'re looking for. Please try again.');
            }
            break;
        default:
            welcome(session);
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
    sendMessage(session, `Hey there! This is ForkDelta Bot. You can look up prices traded on ForkDelta ` +
        'or set price alarms.');
}

/**
 * notify user about set alarm
 * @param session user session to send message to
 * @param symbol of token (e.g. 'REP')
 * @param priceType type of price ('last', 'bid' or 'ask')
 * @param price of that token
 */
function priceNotification(session, symbol, priceType, price) {
    sendMessage(session, 'Price Alarm! ' + priceType + ' price of ' + symbol + ' is ' + price + '.');
}

function sendMessage(session, message) {
    session.set('step', 'start');
    let controls = [
        {type: 'button', label: 'Get a price', value: 'getPrice'},
        {type: 'button', label: 'Set an alarm', value: 'setAlarm'},
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

function getPrice(session, message) {
    session.set('step', 'getPrice');
    session.reply(SOFA.Message({
        body: message,
        controls: [
            {type: 'button', label: 'back', value: 'back'}
        ],
        showKeyboard: true
    }));
}

function setAlarm(session, message) {
    session.set('step', 'setAlarm');
    session.reply(SOFA.Message({
        body: message,
        controls: [
            {type: 'button', label: 'back', value: 'back'}
        ],
        showKeyboard: true
    }));
}


// HELPERS:

function convertEthToUSD(eth) {
    return Fiat.fetch().then((toEth) => {
        let rateUSD = toEth.USD(1);
        return Promise.resolve(eth / rateUSD);
    });
}
