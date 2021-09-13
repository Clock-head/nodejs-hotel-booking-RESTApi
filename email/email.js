const config = require('../lib/config')
const mg = require('mailgun-js')({apiKey: config.mgAPIKey, domain: config.mgDomain})



const mailgun = {}

mailgun.Temp = class {

    constructor (sender, recipient, subject, text, dateOfBooking) {
    this.from = sender,
    this.to = recipient,
    this.subject = subject,
    this.text = text,
    this.dateOfBooking = dateOfBooking
    }

    static welcome (sender, recipient, subject, text, dateOfBooking) {
        return new mailgun.Temp(sender, recipient, subject, text, dateOfBooking)

    }
};

mailgun.send = (emailObj) => {
    return new Promise ((resolve, reject) => {
        setTimeout (() => {
            mg.messages().send(emailObj, function (err, body) {
                if(!err) {
                    resolve(body)
                    
                } else {
                    reject(new Error(err))
                }
            })
        }, 500)
    })
}









module.exports = mailgun