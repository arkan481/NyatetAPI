// middleware to decrypt / validate the token

const jwt = require('jsonwebtoken');
const  asyncHandler = require('./async');
const ErrorResponse = require('../utils/errorResponse');
const User = require('../models/Users');

// protect routes, to send a token everytime they use this route
exports.protect = asyncHandler(async (req, res, next) => {
    let token;
    
    // checking if they send a token in the headers
    if(req.headers.authorization&& req.headers.authorization.startsWith('Bearer')) {
        token = req.headers.authorization.split(' ')[1];
    }else if(req.cookies.token) {
        // token = req.cookies.token;
    }

    // make sure token extsts
    if(!token) {
        return next(new ErrorResponse('Not authorize to access this route', 401));
    }

    try {
        // verify token
        const decodedToken = jwt.verify(token, process.env.JWT_SECRET);

        req.user = await User.findById(decodedToken.id);

        next();
    } catch (error) {
        return next(new ErrorResponse('Not authorize to access this route', 401));
    }
});

// grant access to specific roles
exports.authorize = (...roles) => {
    return (req, res, next) => {
        if(!roles.includes(req.user.role)) {
            return next(new ErrorResponse(`user role ${req.user.role} is unauthorized to access this route`, 403));
        }

        next();
    };
};

// auth ownership for delete and update request
exports.ownerize = (mongoose, customParam) => asyncHandler(async(req, res, next) => {
    let param;

    if(customParam) {
        const paramString = JSON.stringify(req.params).match(customParam).input;
        const paramObj = JSON.parse(paramString);

        param = Object.values(paramObj);
        
    }else {
        param = req.params.id;
    }

    const data = await mongoose.findById(param);

    if(!data) {
        return next();
    }

    const dataOwner = data.user.toString();
    const initiator = req.user._id.toString();

    if(dataOwner !== initiator && req.user.role !== 'admin') {
        return next(new ErrorResponse(`You are not the owner of this resource`,400));
    }

    next();
});