/*
 *
 *
 *  
 * 
 */

// Dependencies

const http = require('http');
const https = require('https')
const url = require('url');
const StringDecoder = require('string_decoder').StringDecoder;
const config = require('./config');
const fs = require('fs')
const _data = require('./data');
const handlers = require('./handlers')
const helpers = require('./helpers')
const Payment = require('../payment/session')
const stripe = require('stripe')(config.stripeKey)
const workers = require('./workers')
const path = require('path')

// The server should respond to all response with a string

const server = {}

server.httpServer = http.createServer(function (req, res) {
    // get the url and parse it
    server.unifiedServer(req, res)
    //log what path the person was asking for
})


server.httpsServerOptions = {
    'key': fs.readFileSync(path.join(__dirname, '/../https/key.pem')),
    'cert': fs.readFileSync(path.join(__dirname, '/../https/cert.pem'))
}

server.httpsServer = https.createServer(server.httpsServerOptions, function (req, res) {
    server.unifiedServer(req, res)
})


server.unifiedServer = function (req, res) {

    const parsedUrl = url.parse(req.url, true)

    // get the path from the url
    const path = parsedUrl.pathname;
    const trimmedPath = path.replace(/^\/+|\/+$/g, '')

    //Get the query string as an object
    const queryStringObject = parsedUrl.query;

    // send the response

    //Get the http method
    const method = req.method.toLowerCase();

    const headers = req.headers;

    const domain = req.headers.host;
    
    const port = domain.replace('localhost', '')

    const protocol = typeof(parseInt(port)) == 'number' && parseInt(port) == 443 ? 'https' : 'http'


    //Get the payload if there is any

    let decoder = new StringDecoder('utf-8');
    let buffer = '';
    req.on('data', function (data) {
        buffer += decoder.write(data)
    })

    req.on('end', function () {
        buffer += decoder.end()

        // Choose the handler this request should go to. If one is not found, use the not found handler.



        let chosenHandler = typeof (server.router[trimmedPath]) !== 'undefined' ? server.router[trimmedPath] : handlers.notFound

        //construct the data object to send to the handler

        // if the request is within the public directory use the public handler instead

        chosenHandler = trimmedPath.indexOf('public/') > -1 ? handlers.public : chosenHandler

        let data = {
            'trimmedPath': trimmedPath,
            'queryStringObject': queryStringObject,
            'method': method,
            'headers': headers,
            'payload': helpers.parseJsonToObject(buffer)
        }

        chosenHandler(data, function (statusCode, payload, contentType) {
            //Use the status code called back by the handler, or default to 200
            statusCode = typeof (statusCode) == 'number' ? statusCode : 200

            // use the payload called back by the handler, or default to the 
            

            let payloadString = '';

            if (contentType === 'json') {

                res.setHeader('Content-Type', 'application/json')
                payload = typeof (payload) == 'object' ? payload : {}
                payloadString = JSON.stringify(payload)

                if (statusCode == 303) {

                const paymentMethod = payload.paymentIntent.payment_method_types
                const lineItems = [{
                    price_data: { currency: 'aud',
                    product_data: {
                        name: 'deluxe',
                    },
                    unit_amount: '30000',
                    },
                    quantity: 1,
                }]
                const mode = 'payment'
                const successUrl = `${protocol}://${domain}/success`
                const cancelUrl = `${protocol}://${domain}/cancel`

                console.log(statusCode)

                console.log(req.headers.host)
                console.log(protocol)

                console.log(successUrl)

                const session = stripe.checkout.sessions.create(Payment.session(paymentMethod, lineItems, mode, successUrl, cancelUrl))
                if(session) {

                const bookingInfo = payload.bookingInfo

                workers.log(bookingInfo)

            
                res.writeHead(statusCode)
                res.end(session.url)

                } else  {
                    console.log('payment failed')

                }
                //write a function call that logs this booking to a data file
            } else {

                res.writeHead(statusCode)
                res.end(payloadString)
            }
            }

            if (contentType === 'html') {
                res.setHeader('Content-Type', 'text/html');
                payloadString = typeof(payload) === 'string' ? payload : ''
                res.writeHead(statusCode)
                res.end(payloadString);

            }

            if (contentType === 'favicon') {
                res.setHeader('Content-Type', 'image/x-icon');
                payloadString = typeof(payload) !== 'undefined' ? payload : ''
                res.writeHead(statusCode)
                res.end(payloadString);

            }

            if (contentType === 'css') {
                res.setHeader('Content-Type', 'text/css');
                payloadString = typeof(payload) !== 'undefined' ? payload : ''
                res.writeHead(statusCode)
                res.end(payloadString);

            }

            if (contentType === 'png') {
                res.setHeader('Content-Type', 'image/png');
                payloadString = typeof(payload) !== 'undefined' ? payload : ''
                res.writeHead(statusCode)
                res.end(payloadString);

            }

            if (contentType === 'jpg') {
                res.setHeader('Content-Type', 'image/jpeg');
                payloadString = typeof(payload) !== 'undefined' ? payload : ''
                res.writeHead(statusCode)
                res.end(payloadString);

            }

            if (contentType === 'plain') {
                res.setHeader('Content-Type', 'text/plain');
                payloadString = typeof(payload) === 'string' ? payload : ''
                res.writeHead(statusCode)
                res.end(payloadString);

            }



            
        })

    })


}

// Define a request router


server.router = {
    '' : handlers.index,
    'account/create' : handlers.accountCreate,
    'account/edit' : handlers.accountEdit,
    'account/deleted' : handlers.accountDeleted,
    'sessions/create' : handlers.sessionCreate,
    'sessions/deleted' : handlers.sessionDeleted,
    'bookings/all' : handlers.bookingsList,
    'bookings/create' : handlers.bookingsCreate,
    'bookings/edit' : handlers.bookingsEdit,
    'ping': handlers.ping,
    'api/guests': handlers.guests,
    'api/tokens': handlers.tokens,
    'api/bookings': handlers.bookings,
    'favicon.ico' : handlers.favicon,
    'public' : handlers.public
}

// Init script
server.init = function () {
    server.httpServer.listen(config.httpPort, function () {
    console.log('The server is listening on port ' + config.httpPort + ' now in ' + config.envName + ' mode')
})
server.httpsServer.listen(config.httpsPort, function (error) {
    if (error) {
        console.log('this is the ' + error)
    } else {
        console.log('The server is listening on port ' + config.httpsPort + ' now in ' + config.envName + ' mode')
    }
})
}

module.exports = server


