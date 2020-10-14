const mongoose = require('mongoose');

const connectDB = async () => {
    var MONGO_URI;

    if(process.env.NODE_ENV === 'production') {
        MONGO_URI = process.env.MONGO_URI_PRODUCTION;
    } else {
        MONGO_URI = process.env.MONGO_URI_DEVELOPMENT;
    }

    const conn = await mongoose.connect(MONGO_URI, {
        useNewUrlParser: true,
        useCreateIndex: true,
        useFindAndModify: false,
        useUnifiedTopology: true,
    });

    console.log(`MongoDB Connected: ${conn.connection.host}`.cyan.underline.italic.bold);
};

module.exports = connectDB;