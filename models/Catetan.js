const mongoose = require('mongoose');

const CatetanSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true,
        minlength: 5
    },
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    }

});

module.exports = mongoose.model('Catetan', CatetanSchema);