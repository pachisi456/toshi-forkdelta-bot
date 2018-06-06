const Bot = require('./lib/Bot');
const SOFA = require('sofa-js');
const Fiat = require('./lib/Fiat');
const IdService = require('./lib/IdService');
const Session = require('./lib/Session');
const Forkdelta = require('./Forkdelta');
const PriceAlert = require('./PriceAlert');

const devAddress = '0x13e56587159d9bead068c0439806609b44974d3f'; // pachisi456's token id address for getting bot statistics

let bot = new Bot();
let forkdelta = new Forkdelta();


// ROUTING AND BOT LOGIC:

bot.onEvent = function (session, message) {
    switch (message.type) {
        case 'Init':
            welcome(session);
            session.set('step', 'start');
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
            sendMessage(session, session.get('step'), 'Sorry, I don\'t take requests.', false);
            break
    }
};

function onCommand(session, command) {
    let symbol;
    switch (command.content.value) {
        case 'cancel':
            if (session.get('step') === 'deleteAlert') {
                sendMessage(session, 'priceAlerts', 'No alert has been set.', false);
                break;
            }
            sendMessage(session, 'start', 'How can I help you?', false);
            break;
        case 'getPrice':
            sendMessage(session, 'start', 'Just send me the official symbol of the token you want to know the price ' +
                'of and I\'ll give it to you.', true);
            break;
        case 'alerts':
            let userAlerts = session.getGlobal(session.user.username);
            if (userAlerts === undefined || userAlerts.length === 0) {
                sendMessage(session, 'priceAlerts', 'You currently don\'t have any price alerts set.', false);
            } else {
                sendMessage(session, 'priceAlerts', 'Here are your alerts:', false);
                sendPriceAlerts(session, userAlerts);
            }
            break;
        case 'setAlert':
            sendMessage(session, 'setAlert', 'What token do you want to set an alert for? Please send me the ' +
                'official symbol.', true);
            break;
        case 'deleteAlert':
            sendMessage(session, 'deleteAlert', 'Please send me the number of the alert you want to delete.', true);
            break;
        case 'bid':
            session.set('priceTypeToSetAlertFor', 'bid');
            symbol = session.get('tokenToSetAlertFor');
            sendMessage(session, 'setAlertPrice', 'Okay, so you want to set an alert for the bid price of ' + symbol + '. ' +
                'Please provide a price in ETH. If the bid price on ForkDelta rises above this price I will ' +
                'let you know.', true);
            break;
        case 'ask':
            session.set('priceTypeToSetAlertFor', 'ask');
            symbol = session.get('tokenToSetAlertFor');
            sendMessage(session, 'setAlertPrice', 'Okay, so you want to set an alert for the ask price of ' + symbol + '. ' +
                'Please provide a price in ETH. If the ask price on ForkDelta falls below this price I will ' +
                'let you know.', true);
            break;
        case 'info':
            welcome(session);
            break;
        case 'contribute':
            sendMessage(session, session.get('step'), 'If you want to request or implement a feature feel free to reach out to ' +
                '@pachisi456. The source code can be found at github.com/pachisi456/toshi-forkdelta-bot. ' +
                'Pull requests with new features will happily be accepted.', false);
            break;
        case 'donate':
            sendMessage(session, session.get('step'), 'If you think this work should be rewarded feel free to leave me a small ' +
                'donation via the PAY button above. Thanks a lot!', false);
            break;
    }
}

async function onMessage(session, message) {
    // statistics for the developer
    if (message.body === 'Stats' && session.address === devAddress) {
        let alerts = await getAlerts();
        let numAlerts = 0;
        for (let alert in alerts) {
            let userAlerts = alerts[alert];
            for (let userAlert in userAlerts) {
                numAlerts++;
            }
        }
        sendMessage(session, session.get('step'), 'Users using alerts: ' + Object.keys(alerts).length + '\nTotal set ' +
            'alerts: ' + numAlerts + '\nPrice calls this week: ' + forkdelta.weeklyPriceCalls + '\nTotal price ' +
            'calls: ' + forkdelta.totalPriceCalls, false);
        return;
    }
    let symbol;
    let handle;
    switch (session.get('step')) {
        case 'setAlert':
            // translate the case-insensitive user input to first to a case-sensitive symbol and then to the human
            // readable handle
            symbol = forkdelta.lookupSymbol(message.body);
            // check if handle was found and thus is traded on forkdelta
            if (symbol != null) {
                session.set('tokenToSetAlertFor', symbol);
                sendMessage(session, 'setAlertPriceType', 'What price of ' + symbol + ' do you want to set an alert ' +
                    'for, bid or ask?', true);
            } else {
                sendMessage(session, 'setAlert', 'Sorry, I couldn\'t find what you\'re looking for. Please try ' +
                    'again.', true);
            }
            break;
        case 'setAlertPrice':
            // verify that user provided a valid price
            let priceArr = message.body.match(/\d+([.|,]\d+)?/g);
            let price = priceArr[0];
            price = price.replace(',', '.');
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

                sendMessage(session, 'priceAlerts', 'Alert for ' + symbol + ' ' + priceType + ' price successfully ' +
                    'set to ' + price + ' ETH. Here\'s your new set of alerts:', false);
                sendPriceAlerts(session, userAlerts);
            } else {
                sendMessage(session, 'setAlertPrice', 'Sorry, I didn\'t get that. Please try again.', true);
            }
            break;
        case 'deleteAlert':
            let alertNo = message.body;
            let userAlerts = session.getGlobal(session.user.username);
            if (alertNo.match(/\d+/g) && userAlerts[alertNo - 1] !== undefined) {
                userAlerts.splice(alertNo - 1, 1);
                session.setGlobal(session.user.username, userAlerts);
                if (userAlerts.length > 0) {
                    sendMessage(session, 'priceAlerts', 'Price alert ' + alertNo + ' deleted. Here\'s your new set of ' +
                        'price alerts:', false);
                    sendPriceAlerts(session, userAlerts);
                } else {
                    sendMessage(session, 'priceAlerts', 'Price alert ' + alertNo + ' deleted. No more alerts set.', false);
                }
                break;
            } else {
                sendMessage(session, 'priceAlerts', 'Sorry, I can\'t find that alert.', false);
                break;
            }
        default:
            // translate the case-insensitive user input to first to a case-sensitive symbol and then to the human
            // readable handle
            symbol = forkdelta.lookupSymbol(message.body);
            handle = forkdelta.getTokenHandleBySymbol(symbol);
            // check if handle was found and thus is traded on forkdelta
            // also catch request for 'eth' -> this is a weird bug the bot otherwise can't handle
            if (handle != null && message.body.toLowerCase() !== 'eth') {
                let last = forkdelta.getPrice(handle, 'last');
                let bid = forkdelta.getPrice(handle, 'bid');
                let ask = forkdelta.getPrice(handle, 'ask');
                let lastUSD = await convertEthToUSD(last);
                let bidUSD = await convertEthToUSD(bid);
                let askUSD = await convertEthToUSD(ask);
                sendMessage(session, session.get('step'), 'Prices for ' + symbol + ':\n' +
                    'last: ' + last + ' ETH ($' + lastUSD + ')\n' +
                    'bid: ' + bid + ' ETH ($' + bidUSD + ')\n' +
                    'ask: ' + ask + ' ETH ($' + askUSD + ')', false);
                forkdelta.weeklyPriceCalls++;
                forkdelta.totalPriceCalls++;
            } else {
                sendMessage(session, session.get('step'), 'Sorry, I couldn\'t find what you\'re looking for. ' +
                    'Please try again.', true);
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
            sendMessage(session, session.get('step'), `Thanks a lot for your donation! 🙏`, false);
        } else if (message.status == 'confirmed') {
            // handle when the payment is actually confirmed!
        } else if (message.status == 'error') {
            sendMessage(session, session.get('step'), `There was an error with your payment!🚫`, false);
        }
    }
}

/**
 * called after new list of trading data was fetched
 * iterates over all set alerts and notifies the according user if a price is over/under the set alert price
 */
module.exports.checkAndSendAlerts = async function () {
    let alerts = await getAlerts();
    // iterate over all alerts
    for (let alert in alerts) {
        let userAlerts = alerts[alert];
        // iterate over all alerts of a specific user
        for (let userAlert in userAlerts) {
            // determine whether the alert should be fired off
            let price = forkdelta.getPrice(userAlerts[userAlert].tokenHandle, userAlerts[userAlert].priceType);
            if (userAlerts[userAlert].priceType === 'bid' && userAlerts[userAlert].price <= price) {
                priceNotification(alert, userAlerts[userAlert].symbol, userAlerts[userAlert].priceType, price);
            } else if (userAlerts[userAlert].priceType === 'ask' && userAlerts[userAlert].price >= price) {
                priceNotification(alert, userAlerts[userAlert].symbol, userAlerts[userAlert].priceType, price);
            }
        }
    }
};


// MESSAGES AND USER INTERACTION:

function welcome(session) {
    sendMessage(session, 'start', 'Hi there! I\'m a bot that utilizes the API of ForkDelta, a decentralized Ethereum Token ' +
        'Exchange with the most ERC20 listings of any exchange. You can ask me for prices traded on ForkDelta ' +
        'and set price alerts.', false);
}

/**
 * notify user about a price according to a set alert
 * @param username user to send message to
 * @param symbol of token (e.g. 'REP')
 * @param priceType type of price (either 'bid' or 'ask')
 * @param price of that token
 */
async function priceNotification(username, symbol, priceType, price) {
    let usd = await convertEthToUSD(price);
    IdService.getUser(username).then((result) => {
        let session = new Session(bot, bot.client.store, bot.client.config, result.token_id, () => {
            sendMessage(session, session.get('step'), 'PRICE ALERT: ' + priceType + ' price of ' + symbol + ' is ' + price +
                ' ETH ($' + usd + ').', false);
            //TODO this throws the user back to step 'start' (Storage.loadBotSession() could be used to load the actual
            // session instead of making up a new one)
        });
    });
}

/**
 * sends a message to a user
 * @param session to send message to
 * @param step the user is currently on (needed to get message controls, see getMsgCtrls())
 * @param message to send the user
 * @param showKeyboard boolean which indicates whether keyboard should be shown or not
 */
function sendMessage(session, step, message, showKeyboard) {
    session.set('step', step);
    getMsgCtrls(step, (controls) => {
        session.reply(SOFA.Message({
            body: message,
            controls: controls,
            showKeyboard: showKeyboard,
        }));
    });
}

/**
 * Sends a user all their set price alerts.
 * @param session to send the alerts to
 * @param userAlerts collection of alerts to send
 */
async function sendPriceAlerts(session, userAlerts) {
    for (let alert in userAlerts) {
        let humanIndex = +alert + 1; // start counting at 1 instead of 0
        let usd = await convertEthToUSD(userAlerts[alert].price);
        sendMessage(session, 'priceAlerts', humanIndex + '. ' + userAlerts[alert].symbol + ': ' +
            userAlerts[alert].priceType + ' price alert set to ' +
            userAlerts[alert].price + ' ETH ($' + usd + ').', false);
    }
}

/**
 * Get message controls depending on the step the user is on.
 * @param step a user is on
 * @param callback usually session.reply() to send a message with the according controls
 */
function getMsgCtrls(step, callback) {
    let controls = [];
    switch (step) {
        case 'start':
            controls = [
                {type: 'button', label: 'Get a price', value: 'getPrice'},
                {type: 'button', label: 'Price alerts', value: 'alerts'},
                {
                    type: 'group', label: 'More', controls: [
                    {type: 'button', label: 'Info', value: 'info'},
                    {type: 'button', label: 'Contribute', value: 'contribute'},
                    {type: 'button', label: 'Donate', value: 'donate'}
                ]
                }
            ];
            break;
        case 'priceAlerts':
            controls = [
                {type: 'button', label: 'Delete alert', value: 'deleteAlert'},
                {type: 'button', label: 'Set alert', value: 'setAlert'},
                {type: 'button', label: 'back', value: 'cancel'},
                {
                    type: 'group', label: 'More', controls: [
                    {type: 'button', label: 'Info', value: 'info'},
                    {type: 'button', label: 'Contribute', value: 'contribute'},
                    {type: 'button', label: 'Donate', value: 'donate'}
                ]
                }
            ];
            break;
        case 'setAlert':
            controls = [
                {type: 'button', label: 'Cancel', value: 'cancel'}
            ];
            break;
        case 'setAlertPriceType':
            controls = [
                {type: 'button', label: 'Bid', value: 'bid'},
                {type: 'button', label: 'Ask', value: 'ask'},
                {type: 'button', label: 'Cancel', value: 'cancel'}
            ];
            break;
        case 'setAlertPrice':
        case 'deleteAlert':
            controls = [
                {type: 'button', label: 'Cancel', value: 'cancel'}
            ];
            break;
    }
    callback(controls);
}


// HELPERS:

/**
 * gets alerts of all users
 * @returns {Promise<*>} alerts of all users
 */
async function getAlerts() {
    let alerts = await bot.client.store.loadBotSession('globals');
    delete alerts.address; // clean up to only have the actual alerts left
    return alerts;
}

/**
 * convertEthToUSD converts and ether price to USD price.
 * @param eth a price denominated in ether
 * @returns {Promise.<TResult>} price denominated in USD and rounded to two decimal places.
 */
function convertEthToUSD(eth) {
    return Fiat.fetch().then((toEth) => {
        let rateUSD = toEth.USD(1);
        let usd = eth / rateUSD;
        return Promise.resolve(usd.toFixed(2));
    });
}
