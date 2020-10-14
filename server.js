// Importing external module
const express = require('express');
const dotenv = require('dotenv');
const colors = require('colors');
const fileupload = require('express-fileupload');
const cookieParser = require('cookie-parser');
const mongoSanitize = require('express-mongo-sanitize');
const helmet = require('helmet');
const xss = require('xss-clean');
const rateLimiter = require('express-rate-limit');
const hpp = require('hpp');
const cors = require('cors');
const morgan = require('morgan');

// Loading config env vars
dotenv.config({
    path: './config/config.env'
});

// importing internal module / middleware
const errorHandler = require('./middlewares/error');

// importing core module
const path = require('path');

// DATABASE - importing mongoose config
const db = require('./config/db');

// ######### ROUTE FILES #########
const auth = require('./routes/auth');
const catetan = require('./routes/catetan');

// instantiating express
const app = express();

// using express json body parser
app.use(express.json());

// using cookie parser
app.use(cookieParser());

// connecting to db with mongoose
db();

// using morgan middleware with dev formatting and only if the app is running on the dev env
if (process.env.NODE_ENV === 'development') {
    app.use(morgan('dev'));
}

// using express file upload
app.use(fileupload());

// SECURITY - using mongo sanitizer to prevent nosql injection
app.use(mongoSanitize());

// SECURITY - using helmet to set the security headers
app.use(helmet());

// SECURITY - using xss to prevent xss attack
app.use(xss());

// SECURITY - setting rate limiter
const limiter = rateLimiter({
    windowMs: process.env.RATE_MINUTE * 60 * 1000, // Access Minute Set
    max: process.env.RATE_MAX_REQUEST // max request per minute set
});

// SECURITY - using the rate limiter
app.use(limiter);

// SECURITY - prevent HTTP param pollution
app.use(hpp());

// SECURITY - make the api accessible for public
app.use(cors());

// setting the public folder to become a static folder
app.use(express.static(path.join(__dirname, 'public')));

// ######### MOUNTING THE ROUTERS #########
app.use('/api/v1/auth', auth);
app.use('/api/v1/catetan', catetan);

// using the custom error handler middleware
app.use(errorHandler);

// 404 Page
app.use((req,res,next) => {
    res.status(404).send('Please read the documentation');
});

// defining the port
const PORT = process.env.PORT || 5000;

// running the server
const server = app.listen(PORT, () => {
    console.log(`Server is running in ${process.env.NODE_ENV} mode on port: ${PORT}`.yellow.bold);
});

// handling all unhandled promise rejctions
process.on('unhandledRejection', (err, promise) => {
    console.log(`Error: ${err.message}`.red.bold);
    // close server & exit process
    server.close(() => {
        process.exit(48);
    });
});