var User = require('../models/user');

module.exports = function (router) {

    var usersRoute = router.route('/users');

    // GET /api/users - Get list of users with query parameters
    usersRoute.get(function (req, res) {
        // Build query
        var query = User.find();

        // Apply 'where' filter if provided
        if (req.query.where) {
            try {
                var whereFilter = JSON.parse(req.query.where);
                query = query.where(whereFilter);
            } catch (e) {
                return res.status(400).json({
                    message: "Bad Request: Invalid JSON in 'where' parameter",
                    data: {}
                });
            }
        }

        // Apply 'sort' if provided
        if (req.query.sort) {
            try {
                var sortOrder = JSON.parse(req.query.sort);
                query = query.sort(sortOrder);
            } catch (e) {
                return res.status(400).json({
                    message: "Bad Request: Invalid JSON in 'sort' parameter",
                    data: {}
                });
            }
        }

        // Apply 'select' if provided
        if (req.query.select) {
            try {
                var selectFields = JSON.parse(req.query.select);
                query = query.select(selectFields);
            } catch (e) {
                return res.status(400).json({
                    message: "Bad Request: Invalid JSON in 'select' parameter",
                    data: {}
                });
            }
        }

        // Apply 'skip' if provided
        if (req.query.skip) {
            query = query.skip(parseInt(req.query.skip));
        }

        // Apply 'limit' if provided (no default limit for users)
        if (req.query.limit) {
            query = query.limit(parseInt(req.query.limit));
        }

        // Check if 'count' is requested
        if (req.query.count === 'true') {
            query.countDocuments(function (err, count) {
                if (err) {
                    return res.status(500).json({
                        message: "Internal Server Error",
                        data: {}
                    });
                }
                res.status(200).json({
                    message: "OK",
                    data: count
                });
            });
        } else {
            // Execute query and return results
            query.exec(function (err, users) {
                if (err) {
                    return res.status(500).json({
                        message: "Internal Server Error",
                        data: {}
                    });
                }
                res.status(200).json({
                    message: "OK",
                    data: users
                });
            });
        }
    });

    // POST /api/users - Create a new user
    usersRoute.post(function (req, res) {
        // Validate required fields
        if (!req.body.name || !req.body.email) {
            return res.status(400).json({
                message: "Bad Request: Name and email are required",
                data: {}
            });
        }

        // Create a new user
        var user = new User();
        user.name = req.body.name;
        user.email = req.body.email;

        // Set pendingTasks if provided, otherwise use default empty array
        if (req.body.pendingTasks) {
            user.pendingTasks = req.body.pendingTasks;
        }

        // Save the user
        user.save(function (err, savedUser) {
            if (err) {
                // Check for duplicate email error
                if (err.code === 11000) {
                    return res.status(400).json({
                        message: "Bad Request: User with this email already exists",
                        data: {}
                    });
                }
                return res.status(500).json({
                    message: "Internal Server Error",
                    data: {}
                });
            }

            res.status(201).json({
                message: "User created successfully",
                data: savedUser
            });
        });
    });

    return router;
}
