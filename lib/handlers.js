/*
*
*
*
*/

const _data = require('./data');
const helpers = require('./helpers');
const Intent = require('../payment/intent')
const config = require('./config')
const stripe = require('stripe')(config.stripeKey)
const workers = require('./workers');
const mailgun = require('../email/email');




const handlers = {}

//Sample handler



const hour = new Date().getHours()
const date = new Date().getDate()
const month = new Date().getMonth() + 1
const year = new Date().getFullYear()

const file = hour+'_'+date+'_'+month

/*
 *
 * HTML Handlers
 *
 */



// Index handlers
handlers.index = function (data, callback) {
    
    if(data.method === 'get') {

        let templateData = {
            'head.title' : 'A-Hotel',
            'head.description' : 'book a room with us today',
            'body.title' : 'Hello templated world!',
            'body.class' : 'index'
        };

        helpers.getTemplate('index', templateData, function(err, str) {
            if (!err && str) {
                helpers.addUniversalTemplates(str, templateData, function (err, str) {
                    if (!err && str) {
                        callback(200, str, 'html')
                    } else {
                        callback(500, str, 'html')
                    }
                })
                
            } else {
                callback(500, undefined, 'html')
            }
        })
    } else {
        callback(405, undefined, 'html')
    }
}

handlers.favicon = (data, callback) => {
    if (data.method === 'get') {
        // Read in the favicon's data
        helpers.getStaticAsset('favicon.ico', function (err, data) {
            if (!err && data) {
                callback(200, data, 'favicon');
            } else {
                callback(500)
            }
        })
    } else {
        callback(405)
    }
}

// public assets

handlers.public = (data, callback) => {
    if (data.method === 'get') {
        // Get the filename being requested
        const trimmedAssetName = data.trimmedPath.replace('public/', '').trim();

        if(trimmedAssetName.length > 0) {
            //Read the asset's data
            helpers.getStaticAsset(trimmedAssetName, function (err, data) {
                if (!err && data) {
                    let contentType = 'plain';

                    if(trimmedAssetName.indexOf('.css') > -1) {
                        contentType = 'css'
                    }
                    if(trimmedAssetName.indexOf('.png') > -1) {
                        contentType = 'png'
                    }
                    if(trimmedAssetName.indexOf('.jpg') > -1) {
                        contentType = 'jpg'
                    }
                    if(trimmedAssetName.indexOf('.ico') > -1) {
                        contentType = 'favicon'
                    }
                    callback(200, data, contentType)
                } else {
                    callback(404)
                }
            })
        } else {
            callback(500)
        }
    } else {
        callback(405)
    }
}

/*
 *
 * JSON API Handlers
 * 
 */

handlers.guests = function (data, callback) {
    const acceptableMethods = ['post', 'get', 'put', 'delete'];
    if (acceptableMethods.indexOf(data.method) > -1) {
        handlers._guests[data.method](data, callback);
    } else {
        callback(405)
    }

}

handlers._guests = {};

// Users - post
//Required data: firstName, lastName, phone, password, tosAgreement, 



handlers._guests.post = function (data, callback) {
    // check that all required fields are filled out

    let symbols = ['@', '#', '$', '%', '^', '&', '*', '(', ')', '!', '1', '2', '3', '4', '5', '6', '7', '8', '9', '0']

    let passwordVer = []
    for (symbol = 0; symbol < symbols.length; symbol++) {
        passwordVer.push(data.payload.password.split('').includes(symbols[symbol]))
    }


    let firstName = typeof (data.payload.firstName.trim()) == 'string' && data.payload.firstName.trim().length > 0 ? data.payload.firstName.trim() : false
    let lastName = typeof (data.payload.lastName.trim()) == 'string' && data.payload.lastName.trim().length > 0 ? data.payload.lastName.trim() : false
    let phone = typeof (parseInt(data.payload.phone.trim())) == 'number' && data.payload.phone.trim().length == 12 ? data.payload.phone.trim() : false
    let password = typeof (data.payload.password.trim()) == 'string' && data.payload.password.trim().length >= 9 && passwordVer.includes(true) ? data.payload.password.trim() : false
    let tosAgreement = typeof (data.payload.tosAgreement) == 'boolean' ? data.payload.tosAgreement : false


    if (password) {
        if (firstName && lastName && phone && tosAgreement) {

            //make sure that the user doesn't already exist
            const read = async () => {
                const package = await _data.read('guests', phone)

                if (package.err) {

                    const hash = helpers.hash(password)


                    const package = await helpers.pbkdf2(hash, 4)


                    if (package.key) {

                        const hashedPassword = package.key
                        const salt = package.randomSalt

                        const userObject = {
                            'firstName': firstName,
                            'lastName': lastName,
                            'phone': phone,
                            'hashedPassword': hashedPassword,
                            'tosAgreement': true
                        }

                        const saltFile = {
                            'phone': phone,
                            'salt': salt
                        }

                        //Store the user

                        const err = await _data.create('guests', phone, userObject)

                        if (!err) {
                            const err = await _data.create('.salt', phone, saltFile)

                            if (!err) {
                                callback(200)
                            } else {
                                callback(500, { 'Error': 'Could not create salt file' })
                            }
                        } else {
                            
                            callback(500, { 'Error': 'Could not create the new user' })
                        }
                    } else {
                        callback(500, { 'Error': 'Could not hash password' })
                    }

                } else {
                    callback(400, { 'error': 'user exists' })
                }
            }

            read()

        } else {
            callback(400, { 'error': 'Missing required fields' })
        }

    } else {
        callback(400, { 'Error': 'weak password' })
    }
};

handlers._guests.get = function (data, callback) {

    const phone = typeof (data.queryStringObject.phone) == 'string' && data.queryStringObject.phone.trim() ? data.queryStringObject.phone.trim() : false
    if (phone) {
        let read = async () => {
            const package = await _data.read('guests', phone)
            if (!package.err && package.data) {
                delete package.data.hashedPassword;
                const data = package.data

                callback(200, data)
            } else {
                callback(404)
            }
        }

        read()

    } else {
        callback(400, { 'Error': 'Missing required field' })
    }

};

//Users - put
//Required data is phone
// Optional data : firstName, lastName, password (at least one must be specified)
//Only let an authenticated user update an object

handlers._guests.put = function (data, callback) {
    const phone = typeof (parseInt(data.payload.phone)) == 'number' && data.payload.phone.trim().length == 12 ? data.payload.phone.trim() : false

    const firstName = typeof (data.payload.firstName) == 'string' && data.payload.firstName.trim().length > 0 ? data.payload.firstName.trim() : false
    const lastName = typeof (data.payload.lastName) == 'string' && data.payload.lastName.trim().length > 0 ? data.payload.lastName.trim() : false
    const password = typeof (data.payload.password) == 'string' && data.payload.password.trim().length > 0 ? data.payload.password.trim() : false

    if (phone) {
        if (firstName || lastName || password) {
            let execute = async () => {
                const package = await _data.read('guests', phone)
                if (!package.err && package.data) {
                    let userData = package.data
                    if (firstName) {
                        userData.firstName = firstName
                    }
                    if (lastName) {
                        userData.lastName = lastName
                    }
                    if (password) {
                        const firstHash = helpers.hash(password)
                        const hashedPassword = await helpers.pbkdf2(firstHash, 4)

                        userData.hashedPassword = hashedPassword
                    }
                    //Store the new updates
                    const err = await _data.update('guests', phone, userData)
                    if (!err) {
                        callback(200, {'Message' : 'Your information has been updated'})

                    } else {
                        
                        callback(500, { 'Error': 'Could not update the user' })
                    }

                } else {
                    callback(400, { 'Error': 'The specified user does not exist' })
                }
            }

            execute()

        } else {
            callback(400, { 'Error': 'Missing fields to update' })
        }

    } else {
        callback(400, { 'Error': 'Missing phone number' })
    }

};

//Users - delete
//Required field - phone
// Only let an auth user delete their object

handlers._guests.delete = function (data, callback) {
    // Check that the phone number is valid
    let phone = typeof (parseInt(data.queryString.phone.trim())) == 'number' && data.queryStringObject.phone.trim().length == 12 ? data.queryString.phone.trim() : false
    if (phone) {
        let execute = async () => {
            const package = await _data.read('guests', phone)
            if (!package.err && package.data) {
                const err = _data.delete('guests', phone)
                if (!err) {
                    callback(200)
                } else {
                    callback(400, { 'Error': 'Could not delete file' })
                }

            } else {
                callback(400, { 'Error': 'Could not find the specified user' })
            }
        }
        execute()
    } else {
        callback(400, { 'Error': 'Missing required field' })
    }
};

handlers.tokens = function (data, callback) {
    const acceptableMethods = ['post', 'get', 'put', 'delete'];
    if (acceptableMethods.indexOf(data.method) > -1) {
        handlers._tokens[data.method](data, callback);
    } else {
        callback(405)
    }
}

handlers._tokens = {}

// Tokens - post
// Required data: phone, password
//Optional data: none

handlers._tokens.post = function (data, callback) {
    let phone = typeof (parseInt(data.payload.phone)) == 'number' && data.payload.phone.trim().length == 12 ? data.payload.phone.trim() : false
    let password = typeof (data.payload.password) == 'string' && data.payload.password.trim().length >= 9 ? data.payload.password.trim() : false
    if (phone && password) {
        //Lookup the user who matches that phone number
        const read = async () => {
            const package = await errNet(_data.read('guests', phone))
            const err = package.ok === true ? false : true
            const data = package.result

            if (!err && data) {

                const userData = data
                const hash = helpers.hash(password)
                const hashedPassword = await helpers.ver(hash, phone)
                console.log(userData.hashedPassword)

                if (hashedPassword == userData.hashedPassword) {
                    const tokenId = helpers.createRandomString(20);

                    const expires = Date.now() + 1000 * 60 * 60;
                    const tokenObject = {
                        'id': tokenId,
                        'phone': phone,
                        'firstName': userData.firstName,
                        'lastName': userData.lastName,
                        'expires': expires
                    }

                    //Store the token

                    const err = await _data.create('tokens', tokenId, tokenObject)

                    if (!err) {
                        callback(200, tokenObject)
                    } else {
                        callback(500, { 'Error': 'Could not create new token' })
                    }
                } else {
                    callback(400, { 'Error': 'password did not match' })
                }

            } else {
                callback(400, { 'Error': 'Could not find the specified user' })
            }
        }
        read()
    } else {
        callback(400, { 'Error': 'Missing required fields' })
    }
}

handlers._tokens.get = function (data, callback) {
    // Required data : id
    //Optional data : none
    const id = typeof (data.queryStringObject.id.trim()) == 'string' && data.queryStringObject.id.trim().length == 20 ? data.queryStringObject.id.trim() : false
    if (id) {
        const execute = async () => {
            const package = await _data.read('tokens', id)
            if (!package.err) {
                const tokenData = package.data
                callback(200, tokenData)
            } else {
                callback(404, { 'Error': 'failure reading token data' })
            }
        }
        execute()
    } else {
        callback(400, { 'Error': 'Missing ID' })
    }
}

//Required fields : id, extend
//Optional data : none

handlers._tokens.put = function (data, callback) {
    const id = typeof (data.payload.id.trim()) == 'string' && data.payload.id.trim().length == 20 ? data.payload.id.trim() : false
    const extend = typeof (data.payload.extend) == 'boolean' && data.payload.extend == true ? data.payload.extend : false

    if (id && extend) {
        const execute = async () => {
            const package = await _data.read('tokens', id)
            if (!package.err && package.data) {
                const tokenData = package.data
                if (tokenData.expires > Date.now()) {
                    tokenData.expires = Date.now() * 1000 * 60 * 60;
                    const err = await _data.update('tokens', id, tokenData)
                    if (!err) {
                        callback(200)
                    } else {
                        callback(400, { 'Error': 'Failed to update token' })
                    }
                } else {
                    callback(400, { 'Error': 'The token has already expired, and cannot be extended' })
                }
            } else {
                callback(404, { 'Error': 'Failed to read token data' })
            }

        }
        execute()
    } else {
        callback(400, { 'Error': 'Missing required fields or fields are invalid' })
    }
}

//Required data : id
//Optional data : none

handlers._tokens.delete = function (data, callback) {
    //Check that the id is valid
    const id = typeof (data.queryStringObject.id.trim()) == 'string' && data.queryStringObject.id.trim().length == 20 ? data.queryStringObject.id.trim() : false
    if (id) {
        const execute = async () => {
            const package = await errNet(_data.read('tokens', id))
            const err = package.ok === true ? false : true
            const data = package.ok === true ? package.result : false

            if (!err && data) {

                const err = await _data.delete('tokens', id)
                if (!err) {
                    callback(200)
                } else {
                    callback(400, { 'Error': 'Deletion failed' })
                }
            } else {
                callback(400, { 'Error': 'Data read failed' })
            }
        }
        execute()

    } else {
        callback(400, { 'Error': 'Invalid ID' })
    }
}

// require header token, check-in date, check-out date, no. of adults, no. of children, no. of infants

handlers.bookings = function (data, callback) {
    const acceptableMethods = ['post', 'get', 'put', 'delete'];
    if (acceptableMethods.indexOf(data.method) > -1) {
        handlers._bookings[data.method](data, callback);
    } else {
        callback(405)
    }
}

// Required data: id
//Required data: checkInDate
// read token data from database

handlers._bookings = {}

handlers._bookings.post = function (data, callback) {

    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
    const roomTypes = ['deluxe', 'superior', 'family']

    //Validate check-in infor

    const checkInDate = typeof (parseInt(data.payload.checkInDate.trim())) == 'number' && data.payload.checkInDate.trim().length == 2 ? data.payload.checkInDate.trim() : false
    const checkInMonth = typeof (data.payload.checkInMonth.trim()) == 'string' && months.indexOf(data.payload.checkInMonth.trim()) > -1 ? data.payload.checkInMonth.trim() : false
    const checkInYear = typeof (parseInt(data.payload.checkInYear.trim())) == 'number' && data.payload.checkInYear.trim().length == 4 ? data.payload.checkInYear.trim() : false
    const checkOutDate = typeof (parseInt(data.payload.checkOutDate.trim())) == 'number' && data.payload.checkOutDate.trim().length == 2 ? data.payload.checkInDate.trim() : false
    const checkOutMonth = typeof (data.payload.checkOutMonth.trim()) == 'string' && months.indexOf(data.payload.checkOutMonth.trim()) > -1 ? data.payload.checkInMonth.trim() : false
    const checkOutYear = typeof (parseInt(data.payload.checkOutYear.trim())) == 'number' && data.payload.checkOutYear.trim().length == 4 ? data.payload.checkOutYear.trim() : false
    const roomType = typeof (data.payload.roomType.trim()) == 'string' && roomTypes.indexOf(data.payload.roomType.trim()) > -1 ? data.payload.roomType.trim() : false
    const noOfAdults = typeof (parseInt(data.payload.noOfAdults.trim())) == 'number' && data.payload.noOfAdults.trim().length > 0 ? data.payload.noOfAdults.trim() : false
    const noOfChildren = typeof (parseInt(data.payload.noOfChildren.trim())) == 'number' && data.payload.noOfChildren.trim().length > 0 ? data.payload.noOfChildren.trim() : false
    const noOfInfants = typeof (parseInt(data.payload.noOfInfants.trim())) == 'number' && data.payload.noOfInfants.trim().length > 0 ? data.payload.noOfInfants.trim() : false
    const quantity = typeof(parseInt(data.payload.quantity.trim())) == 'number' && data.payload.quantity.trim().length > 0 ? data.payload.quantity.trim() : false 

    //querystring id

    const id = typeof (data.queryStringObject.id.trim()) == 'string' && data.queryStringObject.id.trim().length == 20 ? data.queryStringObject.id.trim() : false

    //Validate payment info

    const amount = typeof (parseInt(data.payload.paymentAmount.trim())) == 'number' && data.payload.paymentAmount.trim().length > 0 ? data.payload.paymentAmount.trim() : false
    const currency = typeof (data.payload.currency.trim()) == 'string' && data.payload.currency.trim().length > 0 ? data.payload.currency.trim() : false
    const paymentMethod = typeof (data.payload.paymentMethod) == 'object' ? data.payload.paymentMethod : false
    const email = typeof (data.payload.email.trim()) == 'string' && data.payload.email.trim().length > 0 ? data.payload.email.trim() : false



    const execute = async () => {
        const package = await errNet(_data.read('tokens', id))
        const err = package.ok === true ? false : true
        const data = package.ok === true ? package.result : false
        if (!err && data) {

            const tokenData = data
            if (tokenData.expires > Date.now()) {

                if (checkInDate && checkInMonth && checkInYear && checkOutDate && checkOutMonth && checkOutYear && roomType && noOfAdults && noOfChildren && noOfInfants) {
                    // send booking object into database if card information is valid, or if stripe payments go through.
                    if (amount && currency && paymentMethod && email) {
                        const firstName = tokenData.firstName
                        const lastName = tokenData.lastName
                        const phone = tokenData.phone
                        const date = new Date()
                        const currentDate = date.toString()
                        const bookingId = helpers.createRandomNo(6)

                        const bookingInfo = {
                            bookingId : bookingId,
                            firstName : firstName,
                            lastName : lastName,
                            phone : phone,
                            checkInDate : checkInDate,
                            checkInMonth : checkInMonth,
                            checkInYear : checkInYear,
                            checkOutDate : checkOutDate,
                            checkOutMonth : checkOutMonth,
                            checkOutYear : checkOutYear,
                            roomType : roomType,
                            noOfAdults : noOfAdults,
                            noOfChildren : noOfChildren,
                            noOfInfants : noOfInfants,
                            quantity : quantity,
                            date : currentDate
                        }

                        
                        const intentObj = Intent.pay(amount, currency, paymentMethod, email)
                        const paymentIntent = await stripe.paymentIntents.create(intentObj)
                        
                        const payload = {
                            bookingInfo : bookingInfo,
                            paymentIntent : paymentIntent
                        }

                         const admin = 'james.kai92@zohomail.com'
                         const subject = 'Welcome'
                         const message = `Thank you for booking with us, your booking number is ${bookingId}`
                         const dateOfBooking = currentDate

                        const mailObj = mailgun.Temp.welcome(admin, email, subject, message, dateOfBooking)

                        // this function will throw because domain hasn't been created

                         const package = await errNet(mailgun.send(mailObj))
                         const err = package.ok === true ? false : true
                         const body = package.ok === true ? package.result : false

                        if(paymentIntent) {
                            callback(303, payload)
                        } else {
                            callback(400, {'Error' : 'Unable to make payment'})
                        }
                    } else {
                        callback(400, { 'Error': 'Unable to make payment' })
                    }
                } else {
                    callback(400, { 'Error': 'Missing or invalid information' })
                }
            } else {
                callback(400, { 'Error': 'Token has expired' })
            }
        } else {
            callback(400, { 'Error': 'unable to read data' })
        }
    }
    execute()
}

handlers._bookings.get = function (data, callback) {

    const roomTypes = ['deluxe', 'superior', 'family']

    const userBookingId = typeof(data.payload.bookingId.trim()) === 'string' && data.payload.bookingId.trim().length === 6 ? data.payload.bookingId.trim() : false
    const roomType = typeof(data.payload.roomType.trim()) === 'string' && data.payload.roomType.trim().length > 0 && roomTypes.indexOf(data.payload.roomType.trim()) > -1 ? data.payload.roomType.trim() : false
    const token = typeof(data.payload.token.trim()) === 'string' && data.payload.token.trim().length === 20 ? data.payload.token.trim() : false 
    const dateOfBooking = typeof(data.payload.dateOfBooking.trim()) === 'string' && new Date(data.payload.dateOfBooking.trim()) !== 'Invalid Date' ? data.payload.dateOfBooking.trim() : false 

    const parsedBookingDate = new Date(dateOfBooking)


        const execute = async () => {

            if(parsedBookingDate === Date.now()) {

                //use the .find method to find the booking in this booking list.
            const package = await errNet(_data.read('bookings/'+roomType, 'bookingList'))
            const err = package.ok === true ? false : true
            const data = package.ok === true ? package.result : false 

            if(!err && data) {

                let bookings = data.bookings

                if(userBookingId) {

                    const result = bookings.find(({ bookingId }) => bookingId === userBookingId)

                    const phone = typeof(result.phone.trim()) === 'string' && result.phone.trim().length === 12 ? result.phone.trim() : false

                    handlers._tokens.verifyToken(token, phone, function(tokenIsValid){
                        if(tokenIsValid) {
                            callback(200, result)
                        } else {
                            asyncLog('token is not valid')
                        }
                    })
            } else {
                asyncLog('invalid user booking ID')
            }
            } else {
                asyncLog('data read failed')
            }

            } else {
                //place the decompression function here

                const dir = _data.getDir(dateOfBooking)

                const package = await errNet(_data.decompress('bookings/'+roomType+'/' +dir, 'bookingList'))
                const err = package.ok === true ? false : true
                const obj = package.ok === true ? package.result : false
                
                if(!err) {

                    if (userBookingId) {

                        const userObj = obj.bookings.find(({bookingId}) => bookingId === userBookingId )

                        if(userObj) {
                        callback(200, userObj)
                    } else {
                        asyncLog('user doesn\'t exist, please check booking number again')
                    }
                    } else {
                        asyncLog('invalid user booking ID')
                    }
                    
                } else {
                    asyncLog('decompression failed')
                }
            }
        }
        execute()
}

handlers._bookings.put = function (data, callback) {
    const roomTypes = ['deluxe', 'superior', 'family']
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

    const userBookingId = typeof(data.payload.bookingId) === 'string' && data.payload.bookingId.length === 6 ? data.payload.bookingId : false
    const roomType = typeof(data.payload.roomType) === 'string' && data.payload.roomType.length > 0 && roomTypes.indexOf(data.payload.roomType) > -1 ? data.payload.roomType : false
    const token = typeof(data.payload.token) === 'string' && data.payload.token.length === 20 ? data.payload.token : false
    const dateOfBooking = typeof(data.payload.dateOfBooking.trim()) === 'string' ? new Date(data.payload.dateOfBooking.trim()) !== 'Invalid Date' ? data.payload.dateOfBooking.trim() : data.payload.dateOfBooking : false
    const phone = typeof(parseInt(data.payload.phone.trim())) === 'number' && data.payload.phone.trim().length === 12 ? data.payload.phone.trim() : false

    //Optional information

    const checkInDate = typeof (parseInt(data.payload.checkInDate)) == 'number' && data.payload.checkInDate.length == 2 ? data.payload.checkInDate : false
    const checkInMonth = typeof (data.payload.checkInMonth) == 'string' && months.indexOf(data.payload.checkInMonth) > -1 ? data.payload.checkInMonth : false
    const checkInYear = typeof (parseInt(data.payload.checkInYear)) == 'number' && data.payload.checkInYear.length == 4 ? data.payload.checkInYear : false
    const checkOutDate = typeof (parseInt(data.payload.checkOutDate)) == 'number' && data.payload.checkOutDate.length == 2 ? data.payload.checkInDate : false
    const checkOutMonth = typeof (data.payload.checkOutMonth) == 'string' && months.indexOf(data.payload.checkOutMonth) > -1 ? data.payload.checkInMonth : false
    const checkOutYear = typeof (parseInt(data.payload.checkOutYear)) == 'number' && data.payload.checkOutYear.length == 4 ? data.payload.checkOutYear : false
    const noOfAdults = typeof (parseInt(data.payload.noOfAdults)) == 'number' && data.payload.noOfAdults.length > 0 ? data.payload.noOfAdults : false
    const noOfChildren = typeof (parseInt(data.payload.noOfChildren)) == 'number' && data.payload.noOfChildren.length > 0 ? data.payload.noOfChildren : false
    const noOfInfants = typeof (parseInt(data.payload.noOfInfants)) == 'number' && data.payload.noOfInfants.length > 0 ? data.payload.noOfInfants : false
    const quantity = typeof(parseInt(data.payload.quantity)) == 'number' && data.payload.quantity.length > 0 ? data.payload.quantity : false 
    const roomSwitch = typeof(data.payload.roomSwitch) == 'string' && roomTypes.indexOf(data.payload.roomSwitch) > -1 ? data.payload.roomSwitch : false

        const execute = async () => {
            //use the .find method to find the booking in this booking list.
        handlers._tokens.verifyToken(token, phone, function (tokenIsValid) {

            if (tokenIsValid) {
                if(userBookingId && token && roomType) {

            //if dateOfBooking is today, there's no need to decompress
            let parsedDate = new Date(dateOfBooking)
            
            const dirName = _data.getDir(dateOfBooking)

            if(parsedDate === Date.now()) {

            const execute = async () => {
                const package = await errNet(_data.read('bookings/'+roomType, 'bookingList'))
                const err = package.ok === true ? false : true
                const dataObj = package.ok === true ? package.result : false

            if(!err && dataObj) {
                const userObj = dataObj.bookings.find(({ bookingId }) => bookingId === userBookingId)

                update(userObj, dataObj)

            } else {
                asyncLog('read failed')
            }
            }
            execute()

            } else if(parsedDate !== Date.now()) {

                //decompsplice function retrieves user data from previous dates and deletes from that file,
                const execute = async () => {
                const userObj = await _data.extract(roomType, dirName, userBookingId)

                if(userObj) {
                
                const package = await errNet(_data.read('bookings/'+roomType, 'bookingList'))
                const err = package.ok === true ? false : true
                const dataObj = package.ok === true ? package.result : false

                if(!err && dataObj) {
                
                dataObj.bookings.push(userObj)

                    update(userObj, dataObj)
                
                } else {
                    callback(400, {'Message' : 'Error decompressing and splicing file'})
                }
                }
            }
            execute()
            } else {
                callback(400, {'Message' : 'Error parsing date'})
            }
        } else {
                asyncLog('invalid user booking ID')
                callback(400, {'Error' : 'Invalid booking ID'})
            }
            }
        })
        }
        execute()

const update = (userObj, dataObj) => {

            if(checkInDate || checkInMonth || checkInYear || checkOutDate || checkOutMonth || checkOutYear || roomType || noOfAdults || noOfChildren || noOfInfants || quantity) {

                    const originalData = userObj

                            if(checkInDate) {
                                userObj.checkInDate = checkInDate
                            }
                            if(checkInMonth) {
                                userObj.checkInMonth = checkInMonth
                            }
                            if(checkInYear) {
                                userObj.checkInYear = checkInYear
                            }
                            if(checkOutDate) {
                                userObj.checkOutDate = checkOutDate
                            }
                            if(checkOutMonth) {
                                userObj.checkOutMonth = checkOutMonth
                            }
                            if(checkOutYear) {
                                userObj.checkOutYear = checkOutYear
                            }
                            if (noOfAdults) {
                                userObj.noOfAdults = noOfAdults
                            }
                            if(noOfChildren) {
                                userObj.noOfChildren = noOfChildren
                            }
                            if(noOfInfants) {
                                userObj.noOfInfants = noOfInfants
                            }
                            if(roomSwitch) {

                                userObj.roomType = roomSwitch

                                const execute = async () => {
                                
                                const index = dataObj.bookings.indexOf(originalData)
                                
                                dataObj.bookings.splice(index, 1)
                                
                                const err = await _data.update('bookings/'+roomType, 'bookingList', dataObj) 

                                if(!err) {
                                const package = await errNet(_data.read('bookings/'+roomSwitch, 'bookingList'))
                                const err = package.ok === true ? false : true
                                const switchData = package.ok === true ? package.result : false
                                console.log(switchData)

                                switchData.bookings.push(userObj)
                                
                                if(!err && switchData) {

                                const err = await _data.update('bookings/'+roomSwitch, 'bookingList', switchData)
                                
                                    if(!err) {

                                        const err = await _data.update('bookings/'+roomSwitch, file, switchData)
                                        
                                        if(!err) {
                                            asyncLog(`booking updated, room switched to ${roomSwitch}`)
                                            callback(200, {'Message' : `booking updated, room switched to ${roomSwitch}`})
                                        }
                                    } else {
                                        callback(400, {'Message' : 'Update and room switch failed'})
                                    }
                                } else {
                                    callback(400, {'Error' : 'read error'})
                                }
                                } else {
                                    callback(400, {'Error' : 'Error deleting user'})
                                }
                                }
                                execute()

                            } else {

                                const execute = async () => {
                                
                                const index = dataObj.bookings.indexOf(originalData)
                                dataObj.bookings.splice(index, 1)
                                
                                const updatedBookings = dataObj.bookings.push(result)
                                const err = await _data.update('bookings/'+roomType, 'bookingList', updatedBookings)
                                if(!err) {
                                    const file = workers.file
                                    const err = await _data.update('bookings/'+roomType, file, updatedBookings)
                                    if(!err) {
                                        callback(200, {'Message' : 'data update successful'})
                                    } else {
                                        callback(400, {'Error' : 'level 2 data update failed'})
                                    }
                                } else {
                                    callback(400, {'Error' : 'level 1 data update failed'})
                                }
                                    
                                }
                                execute()
                            }
        } else {
            asyncLog('missing data to update')
            callback(400, {'Error' : 'missing data to update'})
        }
    }
}

handlers._bookings.delete = function (data, callback) {

    const roomTypes = ['deluxe', 'superior', 'family']

    const bookingId = typeof(data.payload.bookingId.trim()) === 'string' && data.payload.bookingId.trim().length === 6 ? data.payload.bookingId.trim() : false
    const token = typeof(data.payload.token.trim()) === 'string' && data.payload.token.trim().length === 20 ? data.payload.token.trim() : false
    const roomType = typeof(data.payload.roomType.trim()) === 'string' && roomTypes.indexOf(data.payload.roomType.trim()) > -1 ? data.payload.roomType.trim() : false
    const dateOfBooking = typeof(data.payload.dateOfBooking.trim()) === 'string' && new Date(data.payload.dateOfBooking.trim()) !== 'Invalid Date' ? data.payload.dateOfBooking.trim() : false
    const phone = typeof(data.payload.phone.trim()) === 'string' && data.payload.phone.trim().length === 12 ? data.payload.phone.trim() : false

    const parsedDate = new Date(dateOfBooking)
    
    handlers._tokens.verifyToken(token, phone, function (tokenIsValid) {
         
        if (tokenIsValid) {
            if (parsedDate === Date.now()) {

                const execute = async () => {
                    const package = await _data.read('bookings/'+roomType, 'bookingList')
                const err = package.ok === true ? false : true
                const data = package.ok === true ? package.result : false

                if (!err && data) {
                    const userObj = data.bookings.find(({bookingId}) => bookingId === userBookingId)

                    if(userObj) {
                        const package = await errNet(_data.delete('bookings/'+roomType, 'bookingList'))
                        const err = package.ok === true ? package.result : true

                        if(!err) {
                            callback(200, {'Message' : 'delete success'})

                        } else {
                            callback(400, {'Message' : 'delete error'})

                        }

                    } else {
                        callback(400, {'Message' : 'user not found'})
                    }

                } else {
                    callback(400, {'Message' : 'Read error'})

                }
                }
                execute()

            } else if (parsedDate !== new Date(dateOfBooking)) {

            const dir = getDir(dateOfBooking)

            if(dir) {
                const execute = async () => {
                const package = await _data.extract(roomType, dir, bookingId)
                const err = package.ok === true ? false : true
                const userObj = package.ok === true ? package.result : false

                if (!err && userObj) {
                    callback(200, {'Message' : 'deleted user object ', userObj})
                } else {


                }
            }
            execute()
            }
    }
    } else {
        callback(400, {'Message' : 'Invalid token'})
    }
    })
}


handlers.ping = function (data, callback) {
    // callback a http status code, and a payload object

    callback(200)

}

// Not found handler

handlers.notFound = function (data, callback) {

    callback(404)

}

const errNet = promise =>
    promise
     .then(result => ({ok: true , result}))
     .catch(error => Promise.resolve({ok: false, error}))

    const asyncLog = package =>
    setTimeout(() => {
        console.log(package)
    }, 50)

handlers._tokens.verifyToken = function(id, phone, callback) {
    //Lookup the token
    let read = async function () {
    const package = await errNet(_data.read('tokens', id))
        const err = package.ok === true ? false : true
        const tokenData = package.ok === true ? package.result : false
        console.log(tokenData)
        if(!err && tokenData) {
            //Check that the token is for the given user and has not expired
            if(tokenData.phone === phone && tokenData.expires > Date.now()) {
                callback(true)
            } else {
                callback(false)
            }
        } else {
            callback (false)
        }
    }
    read()
};

module.exports = handlers