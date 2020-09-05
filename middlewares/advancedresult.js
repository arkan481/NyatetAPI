// middleware for sending advancedresult query
// pagination, selecting specific fields, filtering, sorting, etc.

const advResult = (mongoose, populate) => async (req, res, next) => {
    // query for mongoose operation
    let query;

    // fields to exclude in query params to avoid the model searching for the column name
    const removeFields = ['select', 'sort', 'page', 'limit'];

    const backupQuery = { ...req.query };

    let queryString = req.query;

    removeFields.forEach(param => delete queryString[param]);

    queryString = JSON.stringify(queryString);

    // @desc        advanced operator / matching fields
    // @query       ?fields[operator]=value
    queryString = queryString.replace(/\b(gt|gte|let|lte|in)\b/g, match => {
        return `$${match}`;
    });

    query = mongoose.find(JSON.parse(queryString));

    // @desc        selecting specific fields
    // @query       ?select=value1,value2
    if (backupQuery.select) {
        const fields = backupQuery.select.split(',').join(' ');
        query.select(fields);
    }

    // @desc        sorting the fields
    // @query       ?sort=-value1,value2 (for DESCENDING), ?sort=value1 (for ASCENDING)
    if (backupQuery.sort) {
        const sortBy = backupQuery.sort.split(',').join(' ');
        query.sort(sortBy);
    }

    // PAGINATION STUFF

    // @desc        pagination
    // @query       ?limit=value, ?page=value
    // user defined page position, the default is at the first page(1), ignore the 10
    const page = parseInt(backupQuery.page, 10) || 1;
    // user defined limit results count, the default is 25 results at a time, ignore the 10
    const limit = parseInt(backupQuery.limit, 10) || 25;
    // startIndex calculation
    const startIndex = (page - 1) * limit;
    // endIndex calculation
    const endIndex = page * limit;
    // calculating total documents in the database
    const totalDoc = await mongoose.countDocuments();

    // applying the pagintion stuff
    query.skip(startIndex).limit(limit);

    // out of rut, populating data mongoose
    if(populate) {
        query.populate(populate);
    }

    // constructing the pagination result
    const pagination = {};

    if (endIndex < totalDoc) {
        pagination.next = {
            page: page + 1,
            limit
        };
    }

    if (startIndex > 0) {
        pagination.prev = {
            page: page - 1,
            limit
        };
    }

    // executing the query
    const data = await query;

    // assigning the res object to have the response of advResult
    res.advResult = {
        success: true,
        count: data.length,
        pagination,
        results: data
    }

    next();
}

module.exports = advResult;