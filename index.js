const server = require('./lib/server')
const workers = require('./lib/workers')

const app = {}

app.init = function() {
    //start the server
    server.init()
    //start the workers
    workers.init()
}

app.init()


