// IMPORTING THE UTILS AND MIDDLEWARE
const asyncHandler = require('../middlewares/async');
const ErrorResponse = require('../utils/errorResponse');

// IMPORTING THE MODEL
const Catetan = require('../models/Catetan');

// @desc        Create catetan
// @route       POST /api/v1/catetan
// @access      Private
exports.createCatetan = asyncHandler(async (req, res, next) => {
    const newCatetan = req.body;

    newCatetan.user = req.user._id;

    const data = await Catetan.create(newCatetan);

    res.status(201).json({
        success: true,
        data
    });

});

// @desc        Update catetan by ID
// @route       PUT /api/v1/catetan/:id
// @access      Private, Ownerized
exports.updateCatetan = asyncHandler(async (req, res, next) => {
    const updatingCatetan = req.body;

    const data = await Catetan.findByIdAndUpdate(req.params.id, updatingCatetan, {
        runValidators: true,
        new: true
    });

    res.status(200).json({
        success: true,
        data
    });
});