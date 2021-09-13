/*
* Helpers for various tasks
*
*/

// Container for all the helpers


const crypto = require('crypto')
const config = require('./config')
const _data = require('./data')
const fs = require('fs')
const path = require('path')

const helpers = {}

helpers.baseDir = path.join(__dirname, '/../.data/')


// Create a 

helpers.hash = function (str) {
    if(typeof(str) == 'string' && str.length > 0) {
        let hash = crypto.createHmac('sha256', config.hashingSecret).update(str).digest('hex')
        return hash
    } else {
        return false
    }
}

helpers.pbkdf2 = function (hash, strLength) {
    return new Promise ((resolve, reject) => {
        setTimeout (() => {
        hash = typeof(hash) == 'string' && hash.length > 0 ? hash : false
        //strLength = typeof(strLength) == 'number' && strLength.length ///> 0 ? strLength : false


        if(hash && strLength) {

        const randomSalt = helpers.createRandomString(strLength)

        console.log(randomSalt)

        crypto.pbkdf2(hash, randomSalt, 2000, 32, 'sha512', (err, derivedKey) => {
            if(!err) {
                const key = derivedKey.toString('hex')
                // console.log(key)
                const package = {
                    'key' : key,
                    'randomSalt' : randomSalt
                }

                console.log(key)

                resolve(package)
            } else {
                reject(new Error('hashing failed'))
            }
        })
        } else {
            console.log('missing first layer hash or string length inputs')
        }
    }, 5000)
    })
}

helpers.ver = function (hash, phone) {
    return new Promise ((resolve, reject) => {
        setTimeout (() => {
        hash = typeof(hash) == 'string' && hash.length > 0 ? hash : false
        //strLength = typeof(strLength) == 'number' && strLength.length ///> 0 ? strLength : false
                fs.readFile(helpers.baseDir+'.salt/'+phone+'.json', 'utf-8', (err, data)=> {
            if(!err && data) {
                    let parsedData = helpers.parseJsonToObject(data);
                    const salt = parsedData.salt
                    console.log(salt)
                    crypto.pbkdf2(hash, salt, 2000, 32, 'sha512', (err, derivedKey) => {
                if(!err) {
                const key = derivedKey.toString('hex')
                // console.log(key)
                resolve(key)
                } else {
                reject(new Error('hashing failed'))
                }
                })
                } else {
                    console.log('can\'t reaD')
                }
            })
    }, 5000)
    })
}

helpers.createRandomString = function(strLength){
    strLength = typeof(strLength) == 'number' && strLength > 0 ? strLength : false
    if(strLength) {
        // Define all the possible characters that could go into a string
        var possibleCharacters = 'abcdefghijklmnopqrstuvwxyz0123456789';

        //Start the final string
        var str = '';
        for(i = 1; i <= strLength; i++){
            //Get a random character from the possibleCharacters string
            var randomCharacter = possibleCharacters.charAt(Math.floor(Math.random() * possibleCharacters.length));
            //Append this character to the final string
            str+=randomCharacter;
        }
        //Return the final string
        return str;
    } else {
        return false;
    }
}

helpers.createRandomNo = function(strLength){
    strLength = typeof(strLength) == 'number' && strLength > 0 ? strLength : false
    if(strLength) {
        // Define all the possible characters that could go into a string
        var possibleCharacters = '0123456789';

        //Start the final string
        var str = '';
        for(i = 1; i <= strLength; i++){
            //Get a random character from the possibleCharacters string
            var randomCharacter = possibleCharacters.charAt(Math.floor(Math.random() * possibleCharacters.length));
            //Append this character to the final string
            str+=randomCharacter;
        }
        //Return the final string
        return str;
    } else {
        return false;
    }
}

//Rooms will be assigned to the guest manually on the app.

helpers.assignRoom = (input) => {
    //there could be 9 floors in a hotel
    let bookedRooms = []
    bookedRooms.push(input)
    console.log(bookedRooms)
    // During checkout the
    
}

//Parse a JSON string to an object in all cases without throwing

helpers.parseJsonToObject = function (str) {
    try {
        const obj = JSON.parse(str)
        return obj;
    } catch (e) {
        return {};
    }
}

helpers.getTemplate = function (templateName, data, callback) {
    templateName = typeof(templateName) === 'string' && templateName.length > 0 ? templateName : false
    data = typeof(data) === 'object' && data !== null ? data : {}

    if(templateName) {
        let templatesDir = path.join(__dirname, '/../templates/')
        fs.readFile(templatesDir+templateName+'.html', 'utf-8', (err, str) => {
            if(!err && str && str.length > 0) {
                const finalString = helpers.interpolate(str, data)
                callback(false, finalString)
            } else {
                callback('No template could be found')
            }
        })
    } else {
        callback('A valid template name was not specified')
    }
}

helpers.addUniversalTemplates = function (str, data, callback) {
    str = typeof(str) === 'string' && str.length > 0 ? str : '';
    data = typeof(data) === 'object' && data !== null ? data : {}

    helpers.getTemplate('_header', data, function(err, headerString) {
        if (!err && headerString) {
            helpers.getTemplate('_footer', data, function (err, footerString) {
                if (!err && footerString) {
                    // Add these all together
                    let fullString = headerString+str+footerString
                    callback(false, fullString)
                } else {
                    callback('Could not find the footer template')
                }
            }) 
        } else {
            callback('requested header file does not exist')
        }
    })

}

// Take a given string and a data object and find/replace all the keys within it

helpers.interpolate = function (str, data) {
    str = typeof(str) === 'string' && str.length > 0 ? str : '';
    data = typeof(data) === 'object' && data !== null ? data : {}

    // Add the template globals to the data object, prepending their key name with "global"
    for(let keyName in config.templateGlobals) {
        if(config.templateGlobals.hasOwnProperty(keyName)) {
            data['global.'+keyName] = config.templateGlobals[keyName];
        }
    }

    // For each key in the data object, insert its value into the string at the corresponding placeholder

    for(let key in data) {
        if(data.hasOwnProperty(key) && typeof(data[key]) === 'string') {
            let replace = data[key];
            let find = '{'+key+'}';
            str = str.replace(find, replace);
        }
    }
    
    return str
}

// get the contents of a static (public) asset

helpers.getStaticAsset = function (fileName, callback) {
    fileName = typeof(fileName) === 'string' && fileName.length > 0 ? fileName : false;

    if(fileName) {
        const publicDir = path.join(__dirname, '/../public/')
        fs.readFile(publicDir+fileName, function (err, data) {
            if(!err && data) {
                callback(false, data);
            } else {
                callback('No file could be found')
            }
        })
    } else {
        callback('A valid file name was not specified')
    }
}







module.exports = helpers

