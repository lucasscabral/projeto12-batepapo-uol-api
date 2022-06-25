import express from 'express'
import cors from 'cors'
import { MongoClient } from 'mongodb'
import dotenv from 'dotenv'
import dayjs from 'dayjs'
import joi from 'joi'

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

const participanteSchema = joi.object({
  name: joi.string().required()
})

app.get('/participants', async (req, res) => {
  const { user } = req.headers

  const validou = participanteSchema.validate({ name: user })
  if (validou.error) {
    res.sendStatus(422)
    return
  }
  const todosParticipantes = await db.collection('participantes').find().toArray()
  console.log(todosParticipantes)

  res.send(todosParticipantes)
})
app.post('/participants', async (req, res) => {
  const validou = participanteSchema.validate({ name: req.body.name })
  if (validou.error) {
    res.sendStatus(422)
    return
  }
  const nomeExiste = await db
    .collection('participantes')
    .findOne({ name: req.body.name })
  if (nomeExiste !== null) {
    res.status(409).send('Este nome já está em uso')
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
