const CONFIG = require('./config')

const { OAuth2Client } = require('google-auth-library')

const express = require('express')
const bodyParser = require('body-parser')
const cors = require('cors')

const moment = require('moment')

const corsOrigin = process.env.NODE_ENV === 'production' ? CONFIG.client.prodUrl : CONFIG.client.devUrl
const corsOptions = {
  origin: corsOrigin,
  optionsSuccessStatus: 200
}

const app = express()
const server = require('http').Server(app, { origins: corsOrigin })
const io = require('socket.io')(server)

app.use(bodyParser.raw())
app.use(bodyParser.urlencoded({ extended: true }))
app.use(cors(corsOptions))

const PORT = process.env.PORT || CONFIG.server.devPort
server.listen(PORT, () => { console.log(`Listening on port: ${PORT}`) })

io.on('connection', (socket) => {
  socket.emit('thotsUpdated')
})

let totalCallouts = 0
const thots = []

app.post('/tokensignin', (req, res) => {
  const token = req.body.idtoken
  const oauth2Client = new OAuth2Client(CONFIG.client_id)

  oauth2Client.verifyIdToken({
    idToken: token,
    audience: CONFIG.client_id
  })
    .then((ticket) => {
      const payload = ticket.getPayload()
      // const userid = payload.sub

      const thot = {
        email: payload.email,
        name: payload.name,
        pictureUrl: payload.picture,
        thotCount: 0,
        presentFor: 0,
        thotPercent: 0
      }

      if (!thots.some(e => e.email === payload.email)) {
        thots.push(thot)
        io.emit('thotsUpdated')
      }
      res.status(200).send(payload.name)
    })
    .catch((err) => {
      res.status(500).send('server error')
      console.log(err)
    })
})

app.get('/api/thots', (req, res) => {
  const data = {
    totalCallouts: 0,
    count: 0,
    data: []
  }
  if (thots.length > 0) {
    data.totalCallouts = totalCallouts
    data.count = thots.length
    data.data = thots
  }
  res.status(200).json(data)
})


const interval = 5000 // In milliseconds

async function chooseTheThot () {
  if (thots.length > 0) {
    totalCallouts += 1
    const index = Math.floor(Math.random() * thots.length)
    thots[index].thotCount = thots[index].thotCount + 1

    for (const thot of thots) {
      thot.presentFor = thot.presentFor + 1
      thot.thotPercent = (thot.thotCount * 100 / thot.presentFor)
    }

    const currentTime = new Date()
    io.emit('thotsUpdated', {
      timeOfNext: moment(currentTime).add(interval, 'ms').toDate(),
      lastThot: thots[index].email
    })
  }
}

setInterval(() => {
  chooseTheThot()
}, interval)
