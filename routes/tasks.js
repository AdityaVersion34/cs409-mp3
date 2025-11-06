var Task = require('../models/task');

module.exports = function (router) {

    var tasksRoute = router.route('/tasks');

    // GET /api/tasks - Get list of tasks with query parameters
    tasksRoute.get(function (req, res) {
        // Build query
        var query = Task.find();

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

        // Apply 'limit' if provided, default to 100 for tasks
        if (req.query.limit) {
            query = query.limit(parseInt(req.query.limit));
        } else {
            query = query.limit(100);
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
            query.exec(function (err, tasks) {
                if (err) {
                    return res.status(500).json({
                        message: "Internal Server Error",
                        data: {}
                    });
                }
                res.status(200).json({
                    message: "OK",
                    data: tasks
                });
            });
        }
    });

    // POST /api/tasks - Create a new task
    tasksRoute.post(function (req, res) {
        // Validate required fields
        if (!req.body.name || !req.body.deadline) {
            return res.status(400).json({
                message: "Bad Request: Name and deadline are required",
                data: {}
            });
        }

        // Create a new task
        var task = new Task();
        task.name = req.body.name;
        task.deadline = req.body.deadline;

        // Set optional fields if provided
        if (req.body.description) {
            task.description = req.body.description;
        }
        if (req.body.completed !== undefined) {
            task.completed = req.body.completed;
        }
        if (req.body.assignedUser) {
            task.assignedUser = req.body.assignedUser;
        }
        if (req.body.assignedUserName) {
            task.assignedUserName = req.body.assignedUserName;
        }

        // Save the task
        task.save(function (err, savedTask) {
            if (err) {
                return res.status(500).json({
                    message: "Internal Server Error",
                    data: {}
                });
            }

            res.status(201).json({
                message: "Task created successfully",
                data: savedTask
            });
        });
    });

    var taskIdRoute = router.route('/tasks/:id');

    // GET /api/tasks/:id - Get a specific task by ID
    taskIdRoute.get(function (req, res) {
        var query = Task.findById(req.params.id);

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

        query.exec(function (err, task) {
            if (err) {
                // Handle invalid ObjectId format as 404
                return res.status(404).json({
                    message: "Task not found",
                    data: {}
                });
            }

            if (!task) {
                return res.status(404).json({
                    message: "Task not found",
                    data: {}
                });
            }

            res.status(200).json({
                message: "OK",
                data: task
            });
        });
    });

    return router;
}
