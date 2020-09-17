// IMPORTING THE UTILS AND MIDDLEWARE
const asyncHandler = require('../middlewares/async');
const ErrorResponse = require('../utils/errorResponse');
const crypto = require('crypto');
const path = require('path');
const http = require('https');
const { OAuth2Client } = require('google-auth-library');

// IMPORTING THE UTILS
const mailer = require('../utils/sendEmail');

// IMPORTING THE MODEL
const User = require('../models/Users');

// @desc        Register a user
// @route       POST /api/v1/auth/register
// @access      Public
exports.register = asyncHandler(async (req, res, next) => {
    const { username, email, password, role, identities } = req.body;

    let user;

    if (identities) {
        user = await User.findOne({ email });

        const provider = identities.provider;
        let isAValidToken;

        if (provider === 'facebook') {
            isAValidToken = await validateFBToken(identities.auth_id);
        } else if (provider === 'google') {
            try {
                isAValidToken = await validateGoogleToken(identities.auth_id);
            } catch (error) {
                return next(new ErrorResponse(`Invalid Provider Token!`, 401));
            }
        }
        else {
            return next(new ErrorResponse(`Unknown Login Provider: ${provider}`, 400));
        }

        if (!isAValidToken) {
            return next(new ErrorResponse(`Invalid Provider Token!`, 401));
        }

        if (user) {
            const registeredUser = await User.findOne({
                email,
                identities: {
                    $elemMatch: identities
                }
            });

            if (!registeredUser) {
                // LINKING AN ACCOUNT WITH DIFFERENT LOGIN PROVIDER
                await user.update({
                    $addToSet: {
                        identities: identities
                    }
                }, {
                    runValidators: true,
                    new: true
                });
            } else {
                // LOGGING IN AN ACCOUNT WITH DIFFERENT LOGIN PROVIDER
                return sendTokenResponse(registeredUser, 200, res);
            }

        } else {
            // CREATING ACCOUNT WITH DIFFERENT LOGIN PROVIDER
            user = await User.create({
                username,
                email,
                role,
                $addToSet: {
                    identities
                },
                password: identities.auth_id
            });
        }

    } else {
        // CREATING ACCOUNT WITH ORDINARY SIGNUP
        user = await User.create({
            username,
            email,
            password,
            role
        });
    }

    sendTokenResponse(user, 200, res, req);
});

// @desc        Loging in a user
// @route       POST /api/v1/auth/login
// @access      Public
exports.login = asyncHandler(async (req, res, next) => {
    console.log('login called', req.body);
    const { email, password } = req.body;

    // validate email & password
    if (!email || !password) {
        return next(new ErrorResponse('Please add the email and the password', 400));
    }

    // Check for user
    const user = await User.findOne({ email }).select('+password');

    if (!user) {
        return next(new ErrorResponse('Invalid Credentials', 401));
    }

    // check if password matches
    const isMatch = await user.matchPassword(password);

    if (!isMatch) {
        return next(new ErrorResponse('Invalid Credentials', 401));
    }

    sendTokenResponse(user, 200, res);

});

// @desc        Get current logged in user
// @route       POST /api/v1/auth/me
// @access      Private
exports.getMe = asyncHandler(async (req, res, next) => {
    // the user id is fetched from the auth middleware after authorization

    const user = await User.findById(req.user._id);

    res.status(200).json({
        success: true,
        user
    });
});

// @desc        Update user photo profile
// @route       PUT /api/v1/auth/updatephoto
// @access      Private
exports.updatePhoto = asyncHandler(async (req, res, next) => {

    if (!req.files || !req.files.photo) {
        return next(new ErrorResponse(`Please input a photo`, 400));
    }

    const photo = req.files.photo;

    if (!photo.mimetype.startsWith('image')) {
        return next(new ErrorResponse('Please only upload an image', 400));
    }

    if (!photo.size > process.env.MAX_FILE_UPLOAD) {
        return next(new ErrorResponse(`Please upload an image that is less than ${process.env.MAX_FILE_UPLOAD}`, 400));
    }

    photo.name = `user_photo_${req.user._id}${path.parse(photo.name).ext}`;

    const photoLink = `${req.protocol}://${req.get('host')}/uploads/${photo.name}`;

    // moving the file
    photo.mv(`${process.env.FILE_UPLOAD_PATH}/${photo.name}`, (err) => {
        if (err) {
            return next(new ErrorResponse('Problem with uploading a photo', 500));
        }
    });

    await User.findByIdAndUpdate(req.user._id, {
        photo: photoLink
    }, {
        runValidators: true,
        new: true
    });

    res.status(200).json({
        success: true
    });


});

// @desc        Forgot password
// @route       POST /api/v1/auth/forgotpassword
// @access      Public
exports.forgotPassword = asyncHandler(async (req, res, next) => {

    if (!req.body.email) {
        return next(new ErrorResponse('Email field is required', 400));
    }

    const user = await User.findOne({
        email: req.body.email
    });

    if (!user) {
        return next(new ErrorResponse(`No user associated with ${req.body.email}`, 404));
    }

    // Get reset token
    const resetToken = user.getResetPasswordToken();

    await user.save({
        validateBeforeSave: false
    });

    // create reset url
    const resetUrl = `${req.protocol}://${req.get('host')}/api/v1/auth/resetpassword/${resetToken}`;

    const message = `You are receiving this email because you said so!, please make a PUT request to: ${resetUrl}`;

    try {
        await mailer({
            email: user.email,
            subject: `Password reset token`,
            message
        });

        res.status(200).json({
            success: true,
            msg: "email sent"
        });
    } catch (error) {
        console.error(error);

        // deleting the reset token if anything goes wrong
        user.resetPasswordToken = undefined;
        user.resetPasswordExpire = undefined;

        await user.save({
            validateBeforeSave: false
        });

        return next(new ErrorResponse(`Email could not be send`, 500));
    }

});

// @desc        Reset Password
// @route       PUT /api/v1/auth/resetpassword/:resettoken
// @access      Public
exports.resetPassword = asyncHandler(async (req, res, next) => {
    // get hashed token
    const resetPasswordToken = crypto.createHash('sha256').update(req.params.resettoken).digest('hex').toString();

    // the user id is fetched from the auth middleware after authorization
    const user = await User.findOne({
        resetPasswordToken,
        resetPasswordExpired: {
            "$gt": Date.now()
        }
    });

    if (!user) {
        return next(new ErrorResponse(`Invalid Token`, 400));
    }

    user.password = req.body.password;

    user.resetPasswordToken = undefined;
    user.resetPasswordExpired = undefined;

    await user.save();

    sendTokenResponse(user, 200, res);

});

// @desc        Update user details
// @route       PUT /api/v1/auth/updatedetails/:id
// @access      Private
exports.updateDetails = asyncHandler(async (req, res, next) => {
    const updatingID = req.user._id;

    const updateFields = {
        username: req.body.username
    };

    const data = await User.findByIdAndUpdate(updatingID, updateFields, {
        runValidators: true,
        new: true
    });

    if (!data) {
        return next(new ErrorResponse(`The user with id: ${updatingID} is not found`, 400));
    }

    res
        .status(200)
        .json({
            success: true,
            data
        });

});

// @desc        Update user password
// @route       PUT /api/v1/auth/updatepassword
// @access      Private
exports.updatePassword = asyncHandler(async (req, res, next) => {
    const { oldPassword, newPassword } = req.body;

    if (!oldPassword || !newPassword) {
        return next(new ErrorResponse('Please input your old password and your new password', 400));
    }

    const user = await User.findById(req.user.id).select('+password');

    const isMatch = await user.matchPassword(oldPassword);

    if (!isMatch) {
        return next(new ErrorResponse('Invalid Credentials', 400));
    }

    user.password = newPassword;

    await user.save();

    res.status(200).json({
        success: true,
        msg: "password updated"
    });

});

// @desc        Logging out a user / clear cookie
// @route       GET /api/v1/auth/logout
// @access      Private
exports.logout = asyncHandler(async (req, res, next) => {
    res.cookie('token', 'none', {
        expires: new Date(Date.now() + 10 * 10000),
        httpOnly: true
    });

    res.status(200).json({
        success: true
    });
});

// get token from model, create cookie and send response
const sendTokenResponse = (user, statusCode, res, req) => {
    const token = user.getSignedJwtToken();
    let jsonObj;

    if (req) {
        const link = `${req.protocol}://${req.get('host')}/api/v1/auth/updatephoto`;
        jsonObj = {
            success: true,
            token,
            contentUrl: link
        };
    } else {
        jsonObj = {
            success: true,
            token
        };
    }

    // creating cookie using cookier parser
    const cookieOptions = {
        expires: new Date(Date.now() + process.env.JWT_COOKIE_EXPIRE * 24 * 60 * 60 * 1000),
        httpOnly: true,
    };

    if (process.env.NODE_ENV === 'production') {
        cookieOptions.secure = true;
    }

    res
        .status(statusCode)
        .cookie('token', token, cookieOptions)
        .json(jsonObj);
};

const validateFBToken = async (accessToken) => {
    return new Promise((resolve, reject) => {

        const options = new URL(`https://graph.facebook.com/debug_token?access_token=${process.env.ACCESS_TOKEN_FB}&input_token=${accessToken}`);

        const req = http.request(options, (res) => {

            res.on('data', (chunk) => {
                const data = JSON.parse(chunk);

                if (data.error) {
                    // INVALID ACCESS TOKEN
                    resolve(false);
                } else {
                    // VALID ACCESS TOKEN
                    if (data.data.error) {
                        resolve(false);
                    } else {
                        resolve(true);
                    }
                }
            });

        });

        req.on('error', (e) => {
            reject(e.message);
        });

        req.end();

    });

};

const validateGoogleToken = async (token) => {
    const client = new OAuth2Client(token);

    const ticket = await client.verifyIdToken({
        idToken: token,
        audience: process.env.GOOGLE_CLIENT_ID_ANDROID
    });

    const payload = ticket.getPayload();

    return payload;

};