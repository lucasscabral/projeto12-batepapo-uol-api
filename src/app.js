import express from 'express'
import cors from 'cors'
import { MongoClient } from 'mongodb'
import dotenv from 'dotenv'
import dayjs from 'dayjs'
import joi from 'joi'

dotenv.config()
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

const mensagensSchema = joi.object({
  to: joi.string().required(),
  text: joi.string().required(),
  type: joi.string().required()
})

app.get('/participants', async (req, res) => {
  const { user } = req.headers
  const userExiste = await db
    .collection('participantes')
    .findOne({ name: user })
  if (!userExiste) {
    res.status(422).send('Esse usuário não existe')
    return
  }
  const validou = participanteSchema.validate({ name: user })
  if (validou.error) {
    res.sendStatus(422)
    return
  }
  try {
    const todosParticipantes = await db
      .collection('participantes')
      .find()
      .toArray()

    res.send(todosParticipantes)
  } catch (error) {
    res.sendStatus(422)
  }
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
    res.sendStatus(201)
  } catch (error) {
    res.send(422)
  }
})

app.get('/mensagens', async (req, res) => {
  //{from: 'João', to: 'Todos', text: 'oi galera', type: 'message', time: `${dayjs().format('HH:mm:ss')`}
  const { user } = req.headers
  const numeroMensagens = parseInt(req.query.limit)
  if (!numeroMensagens || numeroMensagens === 0) {
    try {
      const todasMensagens = await db
        .collection('mensagens')
        .find({ $or: [{ from: { $eq: user } }, { to: { $eq: user } }] })
        .toArray()
      res.send(todasMensagens)
    } catch (error) {
      res.sendStatus(422)
    }
  } else {
    try {
      const mensagensLimitadas = await db
        .collection('mensagens')
        .find({ $or: [{ from: { $eq: user } }, { to: { $eq: user } }] })
        .sort({ _id: -1 })
        .limit(numeroMensagens)
        .toArray()
      res.send(mensagensLimitadas.reverse())
    } catch (error) {
      res.sendStatus(422)
    }
  }
})
app.post('/mensagens', async (req, res) => {
  const userRemetente = req.headers.user
  const userExiste = await db
    .collection('participantes')
    .findOne({ name: userRemetente })
  if (userExiste === null) {
    res.sendStatus(422)
    return
  }

  const bodyMensagem = req.body
  if (bodyMensagem.type !== 'message') {
    if (bodyMensagem.type !== 'private_message') {
      res.status(422).send('So pode ser message ou private_message')
      return
    }
  }

  const validar = mensagensSchema.validate(bodyMensagem)
  if (validar.error) {
    res.sendStatus(422)
    return
  }
  try {
    const dadosMensagem = {
      from: userRemetente,
      ...bodyMensagem,
      time: dayjs().format('HH:mm:ss')
    }
    await db.collection('mensagens').insertOne(dadosMensagem)
    res.sendStatus(201)
  } catch (error) {
    res.sendStatus(422)
  }
})

app.post('/status', async (req, res) => {})

app.listen(5000, console.log('Servidor funfando'))
