const express = require('express');

const { createCatetan, updateCatetan } = require('../controllers/catetan');

const { protect, ownerize } = require('../middlewares/auth');

const Model = require('../models/Catetan');

const router = express.Router();

router
.route('/')
.post(protect, createCatetan);

router
.route('/:id')
.put(protect, ownerize(Model), updateCatetan);

module.exports = router;