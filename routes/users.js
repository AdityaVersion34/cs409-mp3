var User = require('../models/user');
var Task = require('../models/task');

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

        // If pendingTasks is provided, validate that all tasks exist
        if (req.body.pendingTasks && req.body.pendingTasks.length > 0) {
            Task.find({ _id: { $in: req.body.pendingTasks } }, function (err, tasks) {
                if (err) {
                    return res.status(500).json({
                        message: "Internal Server Error",
                        data: {}
                    });
                }

                // Check if all tasks exist
                if (tasks.length !== req.body.pendingTasks.length) {
                    return res.status(404).json({
                        message: "One or more tasks not found",
                        data: {}
                    });
                }

                // Check if any of the tasks are completed
                var completedTask = tasks.find(function(task) {
                    return task.completed === true;
                });
                if (completedTask) {
                    return res.status(400).json({
                        message: "Bad Request: Cannot add completed tasks to pendingTasks",
                        data: {}
                    });
                }

                // All tasks exist and are not completed, proceed with user creation
                createUser();
            });
        } else {
            // No pendingTasks, proceed with user creation
            createUser();
        }

        function createUser() {
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

                // If user is created with pendingTasks, assign those tasks to this user
                if (savedUser.pendingTasks && savedUser.pendingTasks.length > 0) {
                    Task.updateMany(
                        { _id: { $in: savedUser.pendingTasks } },
                        { assignedUser: savedUser._id.toString(), assignedUserName: savedUser.name },
                        function (err) {}
                    );
                }

                res.status(201).json({
                    message: "User created successfully",
                    data: savedUser
                });
            });
        }
    });

    var userIdRoute = router.route('/users/:id');

    // GET /api/users/:id - Get a specific user by ID
    userIdRoute.get(function (req, res) {
        var query = User.findById(req.params.id);

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

        query.exec(function (err, user) {
            if (err) {
                // Handle invalid ObjectId format as 404
                return res.status(404).json({
                    message: "User not found",
                    data: {}
                });
            }

            if (!user) {
                return res.status(404).json({
                    message: "User not found",
                    data: {}
                });
            }

            res.status(200).json({
                message: "OK",
                data: user
            });
        });
    });

    // PUT /api/users/:id - Update a user by ID
    userIdRoute.put(function (req, res) {
        // Validate required fields
        if (!req.body.name || !req.body.email) {
            return res.status(400).json({
                message: "Bad Request: Name and email are required",
                data: {}
            });
        }

        User.findById(req.params.id, function (err, user) {
            if (err) {
                return res.status(404).json({
                    message: "User not found",
                    data: {}
                });
            }

            if (!user) {
                return res.status(404).json({
                    message: "User not found",
                    data: {}
                });
            }

            // Check for duplicate email (but allow if it's the same user)
            User.findOne({ email: req.body.email }, function (err, existingUser) {
                if (err) {
                    return res.status(500).json({
                        message: "Internal Server Error",
                        data: {}
                    });
                }

                if (existingUser && existingUser._id.toString() !== req.params.id) {
                    return res.status(400).json({
                        message: "Bad Request: User with this email already exists",
                        data: {}
                    });
                }

                // If pendingTasks is provided, validate that all tasks exist
                var newPendingTasks = req.body.pendingTasks || [];
                if (newPendingTasks.length > 0) {
                    Task.find({ _id: { $in: newPendingTasks } }, function (err, tasks) {
                        if (err) {
                            return res.status(500).json({
                                message: "Internal Server Error",
                                data: {}
                            });
                        }

                        // Check if all tasks exist
                        if (tasks.length !== newPendingTasks.length) {
                            return res.status(404).json({
                                message: "One or more tasks not found",
                                data: {}
                            });
                        }

                        // Check if any of the tasks are completed
                        var completedTask = tasks.find(function(task) {
                            return task.completed === true;
                        });
                        if (completedTask) {
                            return res.status(400).json({
                                message: "Bad Request: Cannot add completed tasks to pendingTasks",
                                data: {}
                            });
                        }

                        // All tasks exist and are not completed, proceed with update
                        updateUser();
                    });
                } else {
                    // No pendingTasks to validate, proceed with update
                    updateUser();
                }

                function updateUser() {
                    // Store old pendingTasks and old name
                    var oldPendingTasks = user.pendingTasks || [];
                    var oldName = user.name;

                    // Update user fields
                    user.name = req.body.name;
                    user.email = req.body.email;
                    user.pendingTasks = newPendingTasks;

                    // Save the updated user
                    user.save(function (err, updatedUser) {
                    if (err) {
                        return res.status(500).json({
                            message: "Internal Server Error",
                            data: {}
                        });
                    }

                    // Update two-way references for tasks
                    // Tasks that were removed from pendingTasks should be unassigned
                    var removedTasks = oldPendingTasks.filter(function(taskId) {
                        return newPendingTasks.indexOf(taskId) === -1;
                    });

                    // Tasks that were added to pendingTasks should be assigned to this user
                    var addedTasks = newPendingTasks.filter(function(taskId) {
                        return oldPendingTasks.indexOf(taskId) === -1;
                    });

                    // Unassign removed tasks
                    if (removedTasks.length > 0) {
                        Task.updateMany(
                            { _id: { $in: removedTasks } },
                            { assignedUser: "", assignedUserName: "unassigned" },
                            function (err) {}
                        );
                    }

                    // Assign added tasks
                    if (addedTasks.length > 0) {
                        Task.updateMany(
                            { _id: { $in: addedTasks } },
                            { assignedUser: req.params.id, assignedUserName: updatedUser.name },
                            function (err) {}
                        );
                    }

                    // If user's name changed, update assignedUserName in ALL tasks assigned to this user
                    if (oldName !== updatedUser.name) {
                        Task.updateMany(
                            { assignedUser: req.params.id },
                            { assignedUserName: updatedUser.name },
                            function (err) {}
                        );
                    }

                    res.status(200).json({
                        message: "User updated successfully",
                        data: updatedUser
                    });
                    });
                }
            });
        });
    });

    // DELETE /api/users/:id - Delete a user by ID
    userIdRoute.delete(function (req, res) {
        User.findById(req.params.id, function (err, user) {
            if (err) {
                // Handle invalid ObjectId format as 404
                return res.status(404).json({
                    message: "User not found",
                    data: {}
                });
            }

            if (!user) {
                return res.status(404).json({
                    message: "User not found",
                    data: {}
                });
            }

            // Unassign all tasks that were assigned to this user
            Task.updateMany(
                { assignedUser: req.params.id },
                { assignedUser: "", assignedUserName: "unassigned" },
                function (err) {
                    if (err) {
                        return res.status(500).json({
                            message: "Internal Server Error",
                            data: {}
                        });
                    }

                    // Now delete the user
                    User.findByIdAndRemove(req.params.id, function (err, deletedUser) {
                        if (err) {
                            return res.status(500).json({
                                message: "Internal Server Error",
                                data: {}
                            });
                        }

                        res.status(200).json({
                            message: "User deleted successfully",
                            data: deletedUser
                        });
                    });
                }
            );
        });
    });

    return router;
}
