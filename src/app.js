import express from 'express'
import cors from 'cors'
import { MongoClient, ObjectId } from 'mongodb'
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
// FUNÇÃO DE EXCLUIR PARTICIPANTES INATIVOS
setInterval(async () => {
  const mensagensSaida = {
    from: '',
    to: 'Todos',
    text: 'Saiu da sala...',
    type: 'status',
    time: dayjs().format('HH:mm:ss')
  }

  const tempoIvalido = Date.now() - 10000
  const participantesInvalidos = await db
    .collection('participantes')
    .find({ lastStatus: { $lt: tempoIvalido } })
    .toArray()
  participantesInvalidos.forEach(async participante => {
    mensagensSaida.from = participante.name
    await db.collection('mensagens').insertOne(mensagensSaida)
  })
  await db
    .collection('participantes')
    .deleteMany({ lastStatus: { $lt: tempoIvalido } })
}, 15000)

// END-POINTS DE PARTICIPANTS
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

  try {
    const nomeExiste = await db
      .collection('participantes')
      .findOne({ name: req.body.name })
    if (nomeExiste !== null) {
      res.status(409).send('Este nome já está em uso')
      return
    }

    const userLogado = { ...req.body, lastStatus: Date.now() }

    await db.collection('participantes').insertOne(userLogado)
    const mensagensEntrada = {
      from: userLogado.name,
      to: 'Todos',
      text: 'Entrou na sala...',
      type: 'status',
      time: dayjs().format('HH:mm:ss')
    }
    await db.collection('mensagens').insertOne(mensagensEntrada)
    res.sendStatus(201)
  } catch (error) {
    res.send(422)
  }
})
// END-POINTS DE MESSAGENS
app.get('/messages', async (req, res) => {
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
app.post('/messages', async (req, res) => {
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
app.delete('/messages/:ID_DA_MENSAGEM', async (req, res) => {
  const idMensagem = req.params.ID_DA_MENSAGEM
  const { user } = req.headers
  const validou = participanteSchema.validate({ name: user })
  if (!validou) {
    res.sendStatus(404)
    return
  }
  try {
    const mensagemExiste = await db
      .collection('mensagens')
      .findOne({ _id: ObjectId(idMensagem) })
    if (!mensagemExiste) {
      res.sendStatus(404)
      return
    }
    const donoMensagem = await db
      .collection('mensagens')
      .findOne({ _id: ObjectId(idMensagem), from: user })
    if (!donoMensagem) {
      res.sendStatus(401)
      return
    }
    await db.collection('mensagens').deleteOne({ _id: ObjectId(idMensagem) })
  } catch (error) {}
})
app.put('/messages/:ID_DA_MENSAGEM', async (req, res) => {
  const idMensagem = req.params.ID_DA_MENSAGEM
  const { user } = req.headers
  const userExiste = await db
    .collection('participantes')
    .findOne({ name: user })
  if (!userExiste) {
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
    const validou = participanteSchema.validate({ name: user })
    if (!validou) {
      res.sendStatus(404)
      return
    }
    const dadosMensagem = {
      from: user,
      ...bodyMensagem,
      time: dayjs().format('HH:mm:ss')
    }
    const mensagemExiste = await db
      .collection('mensagens')
      .findOne({ _id: ObjectId(idMensagem) })
    if (!mensagemExiste) {
      res.sendStatus(404)
      return
    }
    const donoMensagem = await db
      .collection('mensagens')
      .findOne({ _id: ObjectId(idMensagem), from: user })
    if (!donoMensagem) {
      res.sendStatus(401)
      return
    }
    await db.collection('mensagens').updateOne(
      { _id: ObjectId(idMensagem) },
      {
        $set: { from: donoMensagem.text }
      }
    )
    await db.collection('mensagens').insertOne(dadosMensagem)
    res.sendStatus(201)
  } catch (error) {
    res.sendStatus(422)
    return
  }
})
// END-POINTS DE STATUS
app.post('/status', async (req, res) => {
  const { user } = req.headers

  try {
    const userExiste = await db
      .collection('participantes')
      .findOne({ name: user })
    if (!userExiste) {
      res.sendStatus(404)
      return
    }

    await db.collection('participantes').updateOne(
      {
        _id: userExiste._id
      },
      { $set: { lastStatus: Date.now() } }
    )
    res.sendStatus(200)
  } catch (error) {
    res.sendStatus(422)
  }
})

app.listen(5000)
