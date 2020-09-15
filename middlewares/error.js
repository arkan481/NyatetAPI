// CUSTOM ERROR HANDLER MIDDLEWARE

// IMPORTING THE ERROR RESPONSE CLASS
const ErrorResponse = require('../utils/errorResponse');

const errorHandler = (err, req, res, next) => {
    let error = { ...err };

    error.message = err.message;

    // Log to console for dev
    console.log(err.stack.red);

    // Listening for the specific error name / type (e.g castError, etc.).

    if (err.name === 'CastError') {
        // Cast Error Handler
        const message = `Resource not found with id of: ${err.value}`;
        error = new ErrorResponse(message, 404);
    } else if (err.name === 'ValidationError') {
        // Validation Error Handler
        const message = Object.values(err.errors).map(val => val.message);
        error = new ErrorResponse(message, 400);
    }

    if (err.code === 11000) {
        const duplicateObj = err.keyPattern;
        const duplicateKeys = Object.keys(duplicateObj);

        // duplicate key error
        const message = `${duplicateKeys} already exists!`;
        error = new ErrorResponse(message, 400);
    }

    res.status(error.statusCode || 500).json({
        success: false,
        error: error.message || 'Server Error'
    });
};

module.exports = errorHandler;