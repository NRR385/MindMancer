// server.js
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const app = express();

app.use(cors());
app.use(express.json());

mongoose.connect('mongodb://localhost:27017/guess-the-character', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverSelectionTimeoutMS: 5000
})
.then(() => console.log('Connected to MongoDB'))
.catch(err => console.error('MongoDB connection error:', err));

const Character = mongoose.model('characters', new mongoose.Schema({}, { strict: false }));

app.get('/characters', async (req, res) => {
  try {
    const characters = await Character.find();
    res.json(characters);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch characters' });
  }
});

app.get('/properties', async (req, res) => {
  try {
    const characters = await Character.find();
    const props = new Set();
    characters.forEach(c => Object.keys(c._doc).forEach(k => props.add(k)));
    props.delete('_id'); props.delete('__v'); props.delete('name');
    res.json(Array.from(props));
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch properties' });
  }
});

app.post('/characters', async (req, res) => {
  try {
    const character = new Character(req.body);
    await character.save();
    res.json(character);
  } catch (err) {
    res.status(500).json({ error: 'Failed to add character' });
  }
});

app.listen(3000, () => console.log('Backend running on port 3000'));
