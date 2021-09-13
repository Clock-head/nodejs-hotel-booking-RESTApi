
const _data = require('./data')
const config = require('./config')
const helpers = require('./helpers')
const logs = require('./logs')



const workers = {}



workers.bookingLog = {bookings : []}

workers.hour = new Date().getHours()
workers.date = new Date().getDate()
workers.month = new Date().getMonth()

const hour = workers.hour
const date = workers.date
const month = workers.month + 1



workers.log = (bookingObj) => {

    // let bookingLog = workers.bookingLog.bookings

    const file = hour+'_'+date+'_'+month
    console.log(file)

    const roomType = bookingObj.roomType
    const bookingLog = workers.bookingLog

    // bookingLog.push(bookingObj)

    const execute = async () => {
        const package = await errNet(_data.read('bookings/'+roomType, file))
        const err = package.ok === true ? false : true
        const data = package.ok === true ? package.result : false
        if(!err && data) {


        data.bookings.push(bookingObj)
        console.log(data)
    
        const err = await _data.update('bookings/'+roomType, file, data)
        if(!err) {
            const package = await errNet(_data.read('bookings/'+roomType, 'bookingList'))
            const err = package.ok === true ? false : true
            const data = package.ok === true ? package.result : false
            if(!err) {
                data.bookings.push(bookingObj)
                const err = await _data.update('bookings/'+roomType, 'bookingList', data)
                if(!err) {
                    asyncLog('booking list update successful')
                } else {
                    asyncLog('booking list update error')
                }
            } else {
                asyncLog('booking list read failed')
            }
        } else {
            console.log('error updating log')
        }
        } else {
            bookingLog.bookings.push(bookingObj)
            console.log(bookingLog)
            

            const err = await _data.create('bookings/'+roomType, file, bookingLog)

            if(!err) {
                console.log('Entering new hour')
                const compressHour = workers.hour - 3
                const fileName = compressHour+'_'+date+'_'+month

                const err = await _data.update('bookings/'+roomType, 'bookingList', bookingLog)
                if(!err) {

                //workers.bookingLog = {bookings : []}
                
                workers.adjust(roomType)
                } else {
                    asyncLog('booking list update failed')
                }
            } else {
                asyncLog('Error creating new data')
            }
        }
    }
    execute()
}

// this function now creates and updates logs based on the time of day.

// The next function reads data from the present hour and the previous hour

// this adjust function adjusts pricing based on number of bookings between hours with an adjustable market floor and market ceiling

workers.adjust = (roomType) => {
    const previousHour = workers.hour - 1
    const hourBeforePrevious = previousHour - 1
    const date = workers.date
    const month = workers.month

    const previousHourFile = previousHour+'_'+date+'_'+month
    const hourBeforePreviousFile = hourBeforePrevious+'_'+date+'_'+month

    console.log(roomType)

    const ranges = {
    deluxe : {
            lowRange : 1000000,
            midRange : 1250000,
            highRange : 1500000
        },
    superior : {
            lowRange : 1250000,
            midRange : 15000000,
            highRange : 17500000
        },

    family : {
            lowRange : 1500000,
            midRange : 1750000,
            highRange : 2000000
        }
    }

    const lowRange = ranges[roomType].lowRange
    const midRange = ranges[roomType].midRange
    const highRange = ranges[roomType].highRange

    const execute = async () => {
        const package = await errNet(_data.read('bookings/'+roomType, previousHourFile))
        const err = package.ok === true ? false : true
        const data2 = package.ok === true && package.result.bookings.length > 0 ? package.result : {"bookings":[{}]}
        
        if(!err && data2) {
            console.log('data 2 read ok')
            const package = await errNet(_data.read('bookings/'+roomType, hourBeforePreviousFile))
            const err = package.ok === true ? false : true
            const data1 = package.ok === true && package.result.bookings.length > 0 ? package.result : {"bookings":[{}]}
            if(!err && data1) {
                // find an array method that counts how many items there are in an array
                console.log(data2.bookings.length)
                console.log(data1.bookings.length)

                const package = await errNet(_data.read('.pricing', 'pricing'))
                const err = package.ok === true ? false : true
                const pricingData = package.ok === true ? package.result : false

                if(data2.bookings.length > data1.bookings.length) {
                    
                    const recentBookings = data2.bookings.length
                    const previousBookings = data1.bookings.length

                    // this line of code gives the percentage increase of bookings in a floating point value
                    const floatInc = 1 - (previousBookings / recentBookings)
                    console.log(floatInc)

                    const currentPrice = pricingData[roomType]

                    console.log(currentPrice)
                    

                    if(currentPrice <= lowRange) {
                        //If current price is below or equal to low range, there must be a percentage increase x 100% of current price
                        const priceInc = floatInc * currentPrice
                        const newPrice = currentPrice + priceInc

                        //this is the updating step
                        workers.updatePrice(newPrice, roomType)
                    } else if ( lowRange <= currentPrice <= midRange ) {
                        //If current price is between low range and mid range, there will be a percentage increase x 75% of current price
                        const priceInc = floatInc * (currentPrice * 0.75)
                        const newPrice = currentPrice + priceInc 

                        console.log(newPrice)

                        //can I splice in the new price?

                        

                        //this is the updating step
                        workers.updatePrice(newPrice, roomType)

                        console.log(config.roomPricing[roomType])

                    } else if (midRange <= currentPrice <= highRange) {
                        //If current price is between low range and mid range, there will be a percentage increase x 50% of current price
                        const priceInc = floatInc * (currentPrice * 0.5)
                        const newPrice = currentPrice + priceInc

                        
                        //this is the updating step
                        workers.updatePrice(newPrice, roomType)
                        
                    } else if (currentPrice >= highRange) {
                        asyncLog('prices have hit market ceiling')
                    } else {
                        asyncLog('condition 1 error occured')
                    }
                } else if (data2.bookings.length < data1.bookings.length) {

                    const recentBookings = data2.bookings.length
                    const previousBookings = data1.bookings.length

                    const floatDrop = (previousBookings / recentBookings) - 1

                    const currentPrice = pricingData[roomType]

                    if(currentPrice <= lowRange) {

                        console.log('prices have hit market floor')

                    } else if ( lowRange <= currentPrice <= midRange ) {
                        const priceDrop = floatDrop * (currentPrice * 0.5)
                        const newPrice = currentPrice - priceDrop


                        workers.updatePrice(newPrice, roomType)
                    } else if (midRange <= currentPrice <= highRange) {
                        const priceDrop = floatDrop * (currentPrice * 0.75)
                        const newPrice = currentPrice - priceDrop

                        workers.updatePrice(newPrice, roomType)
                    } else {
                        console.log('condition 2 error occured')
                    }

                } else {

                console.log('no increase or decrease in customer bookings')

                }
                //find a math method that compares the two numbers and returns a percentage or a floating point value

                //either multiply or divide the configured room prices

                //setTimeout for 15 minutes to run the quarterAdjust function

            } else {
                asyncLog('file 2 missing')
            }
        } else {
            asyncLog('file missing')
        }
    }
    execute()
}

// this function updates the prices json file

workers.updatePrice = async (newPrice, roomType) => {
    const package = await errNet(_data.read('.pricing', 'pricing'))
    const err = package.ok === true ? false : true
    let currentPrices = package.ok === true ? package.result : false 

    console.log(err)

    console.log(currentPrices)

    if(!err && currentPrices) {

        currentPrices[roomType] = newPrice

        const package = await errNet(_data.update('.pricing', 'pricing', currentPrices))
        const err = package.ok === true ? false : true
        return err

    } else {
        asyncLog('price update error')
    }
}

workers.bookingInit = () => {
    const roomTypes = ['deluxe', 'superior', 'family']
    const hour = workers.hour
    const date = workers.date
    const month = workers.month + 1

    const file = hour+'_'+date+'_'+month
    const data = {bookings : []}

        roomTypes.forEach( async (roomType) => {
            asyncLog('this is running')
            const package = await errNet(_data.read('bookings/'+roomType, file))
            const err = package.ok === false ? true : false
            
            if(err) {
                const package = await errNet(_data.create('bookings/'+roomType, file, data))
                const err = package.ok === true ? false : true
                workers.adjust(roomType)
            if(err) {
                asyncLog(package)
            } else {
                return err
            }
            } else {
                asyncLog('file exists')
            }
        })
}

workers.bookingLogLoop = () => {
    setInterval (()=> {
        workers.bookingInit()
        if(hour === 24) {
            logs.dayClose()
        } else {
            asyncLog('loop as per hour change')
        }
    } , 1000 * 60 * 60)
}

const errNet = promise =>
    promise
     .then(result => ({ok: true , result}))
     .catch(error => Promise.resolve({ok: false, error}))

const asyncLog = package =>
    setTimeout(() => {
        console.log(package)
    }, 500)

workers.init = () => {
    workers.bookingInit()
    workers.bookingLogLoop()
}



//Write a loop function updates the log files every minute

// workers.loggingLoop = () => {
//    setInterval(()=> {
//        const bookingLog = workers.bookingLog
//        const hour = workers.hour
//        workers.log();
//    }, 5000)
//}

//workers.init = () => {
//    workers.loggingLoop()
//}



module.exports = workers 