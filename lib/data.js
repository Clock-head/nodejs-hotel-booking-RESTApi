/*
* Library for storing and editing data
*
*/

const fs = require('fs');
const path = require('path');
const helpers = require('./helpers')
const zlib = require('zlib');


const lib = {}

lib.baseDir = path.join(__dirname, '/../.data/')

//Base directory of the data folder

lib.getDir = data => {
    
const fullDate = new Date(data)
const date = fullDate.getDate()
const month = fullDate.getMonth() + 1
const year = fullDate.getFullYear()

const datedFolder = date+'_'+month+'_'+year

return datedFolder

}


lib.create = async function (dir, file, data) {
    // Open the file for writing
    
        const package = await errNet(openWx(dir, file))
        const fileDescriptor = package.ok === true ? package.result.fileDescriptor : false 

            if(!fileDescriptor) {
                asyncLog(package)
            } else {
            const stringData = JSON.stringify(data);
            //Write to file and close it
            const package = await errNet(lib.writeFile(fileDescriptor, stringData))
            const fd = package.ok === true ? package.result : false
                if(!fd) {
                    asyncLog(package)
                    
                } else {
                const package = await errNet(lib.closeFile(fd))
                const err = package.ok === true ? false : true
                if(err) {
                    asyncLog(package)
                    
                } else {
                    
                    return err
                }
                }
            }
            // Convert data to a string
            //We will be throwing JSON objects at this function
}

lib.read = async function (dir, file) {
    return new Promise ((resolve, reject) => {
        setTimeout (()=>{
            fs.readFile(lib.baseDir+dir+'/'+file+'.json', 'utf-8', (err, data)=> {
                if(!err && data) {
                    
                    const parsedData = helpers.parseJsonToObject(data);
                    
                    resolve(parsedData)
                } else {

                    reject(new Error('failed to read file'))
                }
            })
        }, 200)
    })
}

lib.readB64 = async function (dir, file) {
    return new Promise ((resolve, reject) => {
        setTimeout (()=>{
            fs.readFile(lib.baseDir+dir+'/'+file+'.gz.b64', 'utf-8', (err, data)=> {
                if(!err && data) {
                    const inputBuffer = Buffer.from(data, 'base64')
                    
                    resolve(inputBuffer)
                } else {

                    reject(new Error('failed to read file'))
                }
            })
        }, 200)
    })
}

lib.findBooking = async (dir, file, userBookingId) => {
    const package = lib.read(dir, file)
    const err = package.ok === true ? false : true
    const data = package.ok === true ? package.result : false

    if(!err && data) {
        const bookings = data.bookings
        const result = bookings.find(({ bookingId }) => bookingId === userBookingId)
        if(result) {
            return result
        } else {
            asyncLog('error reading booking data or booking not found')
        }
    } else {
        asyncLog(package)
    }
}

lib.update = async function (dir, file, data) {
    const package = await errNet(openFile(dir, file, data))
    const fileDescriptor = package.ok === true ? package.result.fileDescriptor : false
    const stringData = package.ok === true ? package.result.stringData : false
        if(!fileDescriptor) {
            asyncLog(package)
        } else {
                          await truncateFile(fileDescriptor)
          const package = await errNet(lib.writeFile(fileDescriptor, stringData))
            const err = package.ok === true ? false : true
            if(err) {
                asyncLog(package)
            } else {
                const package = await errNet(lib.closeFile(fileDescriptor))
                const err = package.ok === true ? false : true
                if(err) {
                    asyncLog(package)
                } else {
                    return err
                }
            }
        }
}



lib.append = async function (dir, file, str) {
    
        const package = await errNet(openA(dir, file))
        const fileDescriptor = package.ok === true ? package.result.fileDescriptor : false
        if(!fileDescriptor) {
            asyncLog(package)
        } else {
        const stringData = JSON.stringify(str)
        const package = await errNet(appendFile(fileDescriptor, stringData))
        const err = package.ok === true ? false : true
            if(err) {
            asyncLog(package)
            } else {
                const package = await errNet(lib.closeFile(fileDescriptor))
                const err = package.ok === true ? false : true
                if(err) {
                    asyncLog(package)
                } else {
                    return err
                }
            }
        }
}

lib.compress = async (dir, data) => {
    
    const package = await errNet(lib.gzip(data))
    const buffer = package.ok === true ? package.result : false

    if(buffer) {
        const package = await errNet(lib.openCompress(dir, 'bookingList'))
        const err = package.ok === true ? false : true
        const fileDescriptor = package.ok === true ? package.result.fileDescriptor : false 

        if(!err && fileDescriptor) {

            const package = await errNet(lib.writeFile(fileDescriptor, buffer.toString('base64')))
            const err = package.ok === true ? false : true
            
            if(!err && fileDescriptor) {
                const package = await errNet(lib.closeFile(fileDescriptor))
                const err = package.ok === true ? false : true

                if(!err) {

                    asyncLog('Compression successful')
                    return err

                } else {
                    asyncLog('Compression failed')
                }

            } else {
                asyncLog('write failed')
            }
        } else {
            asyncLog('open failed')
        }
    } else {
        asyncLog('conversion failed')
    }
}

lib.decompress = async (dir, fileName) => {

    const package = await errNet(lib.readB64(dir, fileName))
    const err = package.ok === true ? false : true
    const inputBuffer = package.ok === true ? package.result : true

    if(!err && inputBuffer) {
        
        const package = await errNet(lib.unzip(inputBuffer))
        const err = package.ok === true ? false : true
        const obj = package.ok === true ? package.result : false

        if(!err && obj) {
            
            return obj

        } else {
            asyncLog('failed to get outputBuffer')
        }
    } else {
        asyncLog(package)
    }
} 

lib.extract = async (roomType, dir, userBookingId) => {
    const package = await errNet(lib.decompress('bookings/'+roomType+'/'+dir, 'bookingList'))
            const err = package.ok === true ? false : true
            const obj = package.ok === true ? package.result : false

                if (!err && obj) {
                   const userObj = obj.bookings.find( ( {bookingId} ) => bookingId === userBookingId)
                   const index = obj.bookings.indexOf(userObj)
                   obj.bookings.splice(index, 1)
                    
                    
                   if(userObj) {
                    const package = await errNet(lib.deleteCompressed('bookings/'+roomType+'/'+dir, 'bookingList'))
                    const err = package.ok === true ? false : true


                    
                    if (!err) {
                        const package = await errNet(lib.compress('bookings/'+roomType+'/'+dir, obj))
                        const err = package.ok === true ? false : true

                            if(!err) {
                                
                                return userObj
                            } else {
                                asyncLog(package)
                            }
                    } else {
                        asyncLog(package)
                    }
                   } else {
                    asyncLog('user does not exist')
                   }
                } else {
                    asyncLog(package)
                }
}

lib.delete = function(dir,file) {
    //Unlink the file
    return new Promise ( (resolve, reject) => {
        setTimeout ( () => {
        fs.unlink(lib.baseDir+dir+ '/' +file+ '.json', function(err){
        if(!err){
            resolve(false)
        } else {
            reject(new Error('Error deleting file'))
        }
    })
    }, 300)
    })
}


lib.mkDir = (dir) => {
    return new Promise ((resolve, reject) => {
        setTimeout (() => {
            fs.mkdir(lib.baseDir+dir, (err) => {
                if(!err) {
                    resolve(err)
                } else {
                    reject(new Error('Error creating new directory'))
                }
            })
        })
    })
}

function openWx (dir, file) {
    return new Promise ( (resolve, reject) => {
    setTimeout (() => {
    fs.open(lib.baseDir+dir+'/'+file+'.json', 'wx', function (err, fileDescriptor) {
    if(!err && fileDescriptor) {
        let package = {
            'err' : err,
            'fileDescriptor' : fileDescriptor
        }
        resolve(package)
    } else {
        
        reject(new Error('Failure to open'))
    }
    })
        }, 200)
    })
}

lib.openCompress = (dir, file) => {
    return new Promise ( (resolve, reject) => {
    setTimeout (() => {
    fs.open(lib.baseDir+dir+'/'+file+'.gz.b64', 'wx', function (err, fileDescriptor) {
    if(!err && fileDescriptor) {
        let package = {
            'err' : err,
            'fileDescriptor' : fileDescriptor
        }
        resolve(package)
    } else {
        
        reject(new Error('Failure to open'))
    }
    })
        }, 200)
    })
}


lib.deleteCompressed = function(dir, file) {
    //Unlink the file
    return new Promise ( (resolve, reject) => {
        setTimeout ( () => {
        fs.unlink(lib.baseDir+dir+ '/' +file+ '.gz.b64', function(err){
        if(!err){
            resolve(false)
        } else {
            reject(new Error('Error deleting compressed file'))
        }
    })
    }, 300)
    })
}

function openFile(dir, file, data) {
    //Open the file for writing
    return new Promise ((resolve, reject) => { 
        setTimeout( () => { 
        fs.open(lib.baseDir+dir+'/'+file+'.json', 'r+', 
    function(err, fileDescriptor){
        if(!err, fileDescriptor) {
            var stringData = JSON.stringify(data)
            var dataObj = { 
                    'fileDescriptor': fileDescriptor,
                    'stringData': stringData    
                        }
            console.log('Opening file')
            resolve(dataObj)
        } else {
            reject(new Error('Failure opening file'))
        }
    })
    }, 2000)
    })
}

function openA (dir, file) {
    return new Promise ( (resolve, reject) => {
    setTimeout (() => {
    fs.open(lib.baseDir+dir+'/'+file+'.json', 'a', function (err, fileDescriptor) {
    if(!err && fileDescriptor) {
        let package = {
            'err' : err,
            'fileDescriptor' : fileDescriptor
        }
        resolve(package)
    } else {
        
        reject(new Error('Failure to open'))
    }
    })
        }, 200)
    })
}

function appendFile (fileDescriptor, str) {
    return new Promise ((resolve, reject) => {
        setTimeout (() => {

            fs.appendFile(fileDescriptor, str+','+'\n', function(err) {
                if (!err) {
                    resolve(err)
                } else {
                    reject(new Error('Failure appending to file'))
                }
            })
        }, 200)
    })

}

lib.writeFile = (fileDescriptor, stringData) => {
    return new Promise ( (resolve, reject) => {
        setTimeout (() => {
        fs.writeFile(fileDescriptor, stringData, function (err) {
            if (!err) {
        
            resolve(fileDescriptor)
            } else {
            reject(new Error('failure writing file'))
                }
            })
        }, 200)
    })
}

lib.closeFile = fileDescriptor => {
    return new Promise ((resolve, reject) => {
        setTimeout (() => {
            fs.close(fileDescriptor, function (err) {
                if(!err) {
                    resolve(err)
                } else {
                    reject(new Error('Failure closing file'))
                }
            })
        }, 200)
    })
}

function truncateFile(fileDescriptor) {
    //truncate file
    return new Promise ( (resolve, reject) => {
        setTimeout( () => {
        fs.truncate(fileDescriptor, function (err) {
        if(!err, fileDescriptor) {
            resolve(fileDescriptor)
        } else {
            reject(new Error('Error truncating file'))
        }
    })
    }, 2000)
    })
}

lib.gzip = (input) => {
    return new Promise( (resolve, reject) => {
        setTimeout( () => {

            const inputString = JSON.stringify(input)

            zlib.gzip(inputString, function(err, buffer) {
                if(!err) {
                    resolve(buffer)
                } else {
                    reject(new Error('Error compressing file'))
                }
            })
        }, 200)
    })
}

lib.unzip = (inputBuffer) => {
    return new Promise ((resolve, reject) => {
        setTimeout(() => {
            zlib.unzip(inputBuffer, (err, outputBuffer) => {
                if(!err && outputBuffer) {
                    const str = outputBuffer.toString()
                    
                    const obj = JSON.parse(str)
                    resolve(obj)
                } else {
                    reject(new Error('Error decompressing file'))
                }
            })

        }, 500)
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