// Importing modules
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const UserSchema = new mongoose.Schema({
    "username": {
        type: String,
        required: true,
        minlength: [5, 'Username should have more than 5 characters long'],
        maxlength: [16, 'Username should be less than 16 characters long']
    },
    email: {
        type: String,
        required: true,
        unique: true,
        match: [/^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/, 'Please add a valid email address']
    },
    role: {
        type: String,
        enum: ['user'],
        default: 'user'
    },
    password: {
        type: String,
        minlength: [8, 'Password should have more than 8 characters long'],
        required: true,
        select: false
    },
    photo: {
        type: String,
        default: "no-photo.jpg"
    },
    resetPasswordToken: String,
    resetPasswordExpired: Date,
    createdAt: {
        type: Date,
        default: Date.now
    }
});

// encrypting the password before it gets saved in the database, using bcrypt
UserSchema.pre('save', async function (next) {
    if(!this.isModified('password')) {
        next();
    }

    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);

    next();
});

// method to sign jwt and return the token
UserSchema.methods.getSignedJwtToken = function () {
    return jwt.sign({
        // the payload is the id of the user
        id: this._id
    }, process.env.JWT_SECRET, {
        expiresIn: process.env.JWT_EXPIRE
    });
};

// method to match the user password with the encrypted password in the database
UserSchema.methods.matchPassword = async function(enteredPassword) {
    return await bcrypt.compare(enteredPassword, this.password);
    // returns true / false
};

// generate token for forgot password
UserSchema.methods.getResetPasswordToken = function() {
        // generate a token
        const resetToken = crypto.randomBytes(20).toString('hex');

        // encrypting token and save it to resetpasswordtoken field
        this.resetPasswordToken = crypto
        .createHash('sha256')
        .update(resetToken)
        .digest('hex');
    
        // set expire to 10 minute
        this.resetPasswordExpired = Date.now() + 10 * 60 *1000;
        
        // returning the un-encrypted token to the suser
        return resetToken;
};

module.exports = mongoose.model('User', UserSchema);