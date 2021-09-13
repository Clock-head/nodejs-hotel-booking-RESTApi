const _data = require('./data')
const workers = require('./workers')
const path = require('path')


const lib = {}

lib.baseDir = path.join(__dirname, '/../.data/')

lib.dayClose = () => {

    const roomTypes = ['deluxe', 'superior', 'family']
    const hours = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12', '13', '14', '15', '16', '17', '18', '19', '20', '21', '22', '23']

    roomTypes.forEach( async roomType => {

        lib.date = new Date().getDate()
        lib.month = new Date().getMonth()
        lib.year = new Date().getFullYear()
        

        const date = lib.date
        const month = lib.month + 1
        const year = lib.year

        const dirName = date+'_'+month+'_'+year

        const package = await errNet(_data.mkDir('bookings/'+roomType+'/'+dirName))
        const err = package.ok === true ? false : true
        
        if(!err) {
        
        const package = await errNet(_data.read('bookings/'+roomType, 'bookingList'))
        const err = package.ok === true ? false : true
        const data = package.ok === true ? package.result : false
        
        if(!err) {

        const err = await _data.compress('bookings/'+roomType+'/'+dirName, data)

        if(!err) {
        
        const emptyLog = {bookings:[{}]}

        const package = await errNet(_data.update('bookings/'+roomType, 'bookingList', emptyLog))
        const err = package.ok === true ? false : true

        if(!err) {
            hours.forEach( async hour => {

        const file = hour+'_'+date+'_'+month

        const package = await errNet(_data.delete('bookings/'+roomType, file))
        const err = package.ok === true ? false : true
        if(!err) {
            asyncLog(package)
            //compression of booking List file
        } else {
            asyncLog(package)
        }
    })
        } else {
            asyncLog(package)
        }
        } else {
            asyncLog(package)
        }
    asyncLog(package)

        } else {
            asyncLog(package)
        }
} else {
    asyncLog(package)
}
})
}

const errNet = promise =>
    promise
     .then(result => ({ok: true , result}))
     .catch(error => Promise.resolve({ok: false, error}))

const asyncLog = package =>
    setTimeout(() => {
        console.log(package)
    }, 50)


module.exports = lib