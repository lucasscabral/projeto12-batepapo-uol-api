import express from 'express'
import cors from 'cors'
import { MongoClient } from 'mongodb'
import dotenv from 'dotenv'
import dayjs from 'dayjs'

dotenv.config()
console.log(dayjs().format('HH:mm:ss'))
const app = express()
app.use(cors())
app.use(express.json())

const mongoClient = new MongoClient(process.env.MONGO_URI)
let db

mongoClient.connect().then(() => {
  db = mongoClient.db('BatePapoUolDB')
})

app.get('/participants', async (req, res) => {
  // É FEITA PRIMEIRO UMA ANALISE PRA VER QUEM ESTA ENTRANDO NA SALA, PRA DEPOIS EXIBIR AS MENSAGENS

  const { user } = req.headers

  res.send(user)
})
app.post('/participants', async (req, res) => {
  if (req.body.name === '') {
    res.sendStatus(422)
    return
  }
  const userLogado = { ...req.body, lastStatus: Date.now() }

  try {
    await db.collection('participantes').insertOne(userLogado)
    console.log(userLogado)
    res.sendStatus(200)
  } catch (error) {
    res.send(422)
  }
})

app.get('/mensagens', async (req, res) => {})
app.post('/mensagens', async (req, res) => {})

app.post('/status', async (req, res) => {})

app.listen(5000, console.log('Servidor funfando'))
